import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getMainStoryHours, resetHltbCache } from '@/lib/hltb/api';
import { getCronSecret } from '@/lib/env.server';

export const maxDuration = 30;

const CANARY_GAME = 'Portal';
const MIN_EXPECTED_HOURS = 1;
const MAX_EXPECTED_HOURS = 20;
const TOTAL_BUDGET_MS = 25_000;
const PING_TIMEOUT_MS = 3_000;
const PULSEMON_PING_URL = 'https://pulsemon.dev/api/ping/hltb-health';

type PingStatus = 'start' | 'success' | 'fail';

async function pingPulsemon(status: PingStatus, body?: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    await fetch(`${PULSEMON_PING_URL}?status=${status}`, {
      method: 'POST',
      body: body ?? '',
      signal: controller.signal,
    });
  } catch (err) {
    // Best effort — a failed ping shouldn't fail the route.
    console.error(`[hltb-health] pulsemon ping (${status}) failed:`, err);
  } finally {
    clearTimeout(timer);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`HLTB check exceeded ${ms}ms wall-clock budget`)), ms),
    ),
  ]);
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

  const start = Date.now();
  await pingPulsemon('start');

  try {
    // Force the check to exercise the full bundle-scraping path instead of
    // reading a warm-instance cached config that might mask a regression.
    resetHltbCache();

    const hours = await withTimeout(getMainStoryHours(CANARY_GAME), TOTAL_BUDGET_MS);
    const duration = Date.now() - start;

    if (hours === null) {
      throw new Error(`HLTB returned null for canary "${CANARY_GAME}"`);
    }
    if (hours < MIN_EXPECTED_HOURS || hours > MAX_EXPECTED_HOURS) {
      throw new Error(
        `HLTB returned ${hours}h for "${CANARY_GAME}" — expected ${MIN_EXPECTED_HOURS}-${MAX_EXPECTED_HOURS}h`,
      );
    }

    await pingPulsemon('success', `${CANARY_GAME}: ${hours}h in ${duration}ms`);
    return NextResponse.json({ ok: true, game: CANARY_GAME, hours, duration });
  } catch (err) {
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err);
    await pingPulsemon('fail', `${message} (after ${duration}ms)`);
    return NextResponse.json({ ok: false, error: message, duration }, { status: 500 });
  }
}
