import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchGameMetadata } from '@/lib/games/metadata-fetch';
import { getCronSecret } from '@/lib/env.server';

export const maxDuration = 300;

// Per-run caps. Weekly schedule × 4 weeks ≈ 2400 app_ids/month, well under the
// 5k/month HLTB budget we agreed on. Adjust if observed latency leaves headroom.
const NULL_HLTB_BUDGET = 150;
const STALE_REVIEW_BUDGET = 450;

// Stale threshold for the second bucket — reviews, tags, deck compat drift.
const STALE_REVIEW_DAYS = 30;

// Exponential backoff on repeated null-HLTB results. Index = attempts so far.
// Values are calibrated for the weekly cron: backoffs below the 7-day run
// interval are meaningless (the next run is always ≥ 7 days away), so the
// first real delay starts at 14 days. After 5+ attempts the row is effectively
// dormant (~quarterly) but still self-healing if HLTB eventually lists it.
const HLTB_BACKOFF_DAYS = [0, 7, 14, 28, 56, 91];

// Slack when comparing "is this row due?" — because the cron fires on a fixed
// schedule, a backoff of exactly 7 days can miss by seconds of clock drift and
// punt the row by a full extra week. Half a day of grace makes 7-day buckets
// reliably line up with the weekly cadence.
const DUE_SLACK_MS = 12 * 60 * 60 * 1000;

function backoffDaysFor(attempts: number): number {
  if (attempts < 0) return 0;
  if (attempts >= HLTB_BACKOFF_DAYS.length) {
    return HLTB_BACKOFF_DAYS[HLTB_BACKOFF_DAYS.length - 1];
  }
  return HLTB_BACKOFF_DAYS[attempts];
}

// Concurrency cap on in-flight fetches. Each fetch makes up to 5 upstream HTTP
// calls (Steam store + HLTB + reviews + tags + deck), so 4 concurrent workers
// ≈ 20 in-flight requests, which is polite to HLTB and Steam alike.
const CONCURRENCY = 4;

// Hard wall-clock cap, leaving buffer inside Vercel's 300s cron limit.
const WALL_CLOCK_BUDGET_MS = 270_000;

interface RefreshCounters {
  considered: number;
  succeeded: number;
  failed: number;
  nullHltbReset: number;
  nullHltbStillMissing: number;
}

export async function GET(request: NextRequest) {
  let cronSecret: string;
  try {
    cronSecret = getCronSecret();
  } catch {
    return NextResponse.json({ error: 'Server config error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();
  const deadline = startedAt + WALL_CLOCK_BUDGET_MS;

  try {
    const nullHltbCandidates = await fetchNullHltbCandidates(supabase);
    const staleReviewCandidates = await fetchStaleReviewCandidates(supabase);

    // Process null-HLTB bucket first — it's the higher-signal path (new
    // releases waiting for data). Stale review refreshes are opportunistic.
    const counters: RefreshCounters = {
      considered: 0,
      succeeded: 0,
      failed: 0,
      nullHltbReset: 0,
      nullHltbStillMissing: 0,
    };

    await processBucket(nullHltbCandidates, supabase, deadline, counters);
    await processBucket(staleReviewCandidates, supabase, deadline, counters);

    const duration = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      duration,
      buckets: {
        nullHltb: nullHltbCandidates.length,
        staleReview: staleReviewCandidates.length,
      },
      ...counters,
    });
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message, duration: Date.now() - startedAt },
      { status: 500 },
    );
  }
}

type ServiceClient = ReturnType<typeof createServiceClient>;

interface Candidate {
  app_id: number;
  name: string | null;
  hltb_attempts: number;
  had_hltb: boolean;
}

async function fetchNullHltbCandidates(supabase: ServiceClient): Promise<Candidate[]> {
  // Pull a generous window and filter client-side by the per-row backoff.
  // Doing the CASE-based interval check in SQL would require an RPC; since
  // the window is small (few hundred rows), client-side filtering is fine.
  const { data, error } = await supabase
    .from('game_metadata')
    .select('app_id, name, hltb_attempts, synced_at')
    .eq('type', 'game')
    .is('main_story_hours', null)
    .order('synced_at', { ascending: true })
    .limit(NULL_HLTB_BUDGET * 3);

  if (error) throw error;
  if (!data) return [];

  const now = Date.now();
  const due = data.filter((row) => {
    const backoffMs = backoffDaysFor(row.hltb_attempts ?? 0) * 24 * 60 * 60 * 1000;
    if (backoffMs === 0) return true;
    return now - new Date(row.synced_at).getTime() >= backoffMs - DUE_SLACK_MS;
  });

  return due.slice(0, NULL_HLTB_BUDGET).map((row) => ({
    app_id: row.app_id,
    name: row.name,
    hltb_attempts: row.hltb_attempts ?? 0,
    had_hltb: false,
  }));
}

async function fetchStaleReviewCandidates(supabase: ServiceClient): Promise<Candidate[]> {
  const staleBefore = new Date(Date.now() - STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('game_metadata')
    .select('app_id, name, hltb_attempts, synced_at')
    .eq('type', 'game')
    .not('main_story_hours', 'is', null)
    .lt('synced_at', staleBefore)
    .order('synced_at', { ascending: true })
    .limit(STALE_REVIEW_BUDGET);

  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    app_id: row.app_id,
    name: row.name,
    hltb_attempts: row.hltb_attempts ?? 0,
    had_hltb: true,
  }));
}

async function processBucket(
  candidates: Candidate[],
  supabase: ServiceClient,
  deadline: number,
  counters: RefreshCounters,
): Promise<void> {
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      if (Date.now() >= deadline) return;
      const candidate = candidates[cursor++];
      counters.considered++;
      try {
        await refreshOne(candidate, supabase, counters);
        counters.succeeded++;
      } catch (err) {
        counters.failed++;
        Sentry.captureException(err, { tags: { app_id: String(candidate.app_id) } });
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
}

async function refreshOne(
  candidate: Candidate,
  supabase: ServiceClient,
  counters: RefreshCounters,
): Promise<void> {
  const metadata = await fetchGameMetadata(candidate.app_id, candidate.name ?? undefined);
  if (!metadata) return;

  // HLTB backoff bookkeeping: reset on success, increment on continued null.
  // We only track attempts for game-type rows, which is where HLTB applies.
  let nextAttempts = candidate.hltb_attempts;
  if (metadata.type === 'game') {
    if (metadata.main_story_hours !== null) {
      if (candidate.hltb_attempts > 0) counters.nullHltbReset++;
      nextAttempts = 0;
    } else {
      counters.nullHltbStillMissing++;
      nextAttempts = candidate.hltb_attempts + 1;
    }
  }

  const { error: upsertError } = await supabase
    .from('game_metadata')
    .upsert({ ...metadata, hltb_attempts: nextAttempts }, { onConflict: 'app_id' });

  if (upsertError) throw upsertError;

  // Fan-out: push the refreshed data to every user's games row for this
  // app_id. No user_id filter — service role bypasses RLS deliberately here.
  const { error: fanoutError } = await supabase
    .from('games')
    .update({
      platform: metadata.platform,
      type: metadata.type,
      genres: metadata.genres,
      categories: metadata.categories,
      description: metadata.description,
      release_date: metadata.release_date,
      header_image: metadata.header_image,
      steam_review_score: metadata.steam_review_score,
      steam_review_count: metadata.steam_review_count,
      steam_review_weighted: metadata.steam_review_weighted,
      main_story_hours: metadata.main_story_hours,
      deck_compat: metadata.deck_compat,
      tags: metadata.tags,
    })
    .eq('app_id', candidate.app_id);

  if (fanoutError) throw fanoutError;
}
