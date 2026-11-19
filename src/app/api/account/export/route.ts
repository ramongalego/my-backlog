import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import {
  buildExport,
  exportFileName,
  gamesCsv,
  type ExportGameRow,
  type ExportRows,
} from '@/lib/account/export';

const FAILED = "Couldn't prepare your data. Please try again.";

/**
 * Most reads go through the player's session, so row-level security holds
 * them to their own rows; share pages and support messages need the server's
 * key and are asked for by the player's id. No password is asked: everything
 * in the file is already on pages a signed-in player can open.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  if (format !== 'json' && format !== 'csv') return jsonError('Unknown format', 400);

  const limit = await checkSharedRateLimit(`account-export:${user.id}`, RATE_LIMITS.accountExport);
  if (!limit.success) return rateLimited(limit);

  const service = tryCreateServiceClient();
  if (!service) return jsonError(FAILED, 500);

  let rows: ExportRows;
  try {
    const read = async <T>(query: PromiseLike<{ data: unknown; error: unknown }>) => {
      const { data, error } = await query;
      if (error) throw error;
      return data as T | null;
    };
    const [
      profile,
      games,
      queue,
      favorites,
      insights,
      sharePages,
      supportMessages,
      history,
      picks,
    ] = await Promise.all([
      read<{
        steam_id: string | null;
        steam_username: string | null;
        display_name: string | null;
        username: string | null;
      }>(
        supabase
          .from('profiles')
          .select('steam_id, steam_username, display_name, username')
          .eq('id', user.id)
          .maybeSingle(),
      ),
      fetchAllRows<ExportGameRow>((from, to) =>
        supabase
          .from('games')
          .select(
            'id, name, source, platform, app_id, steam_app_id, status, rating, notes, started_at, finished_at, dropped_at, playtime_forever, last_played_at, created_at, header_image, art_chosen',
          )
          .eq('user_id', user.id)
          // Not Steam's soundtracks and tools; a game not synced yet has no type.
          .or('type.eq.game,type.is.null')
          .order('id')
          .range(from, to),
      ),
      read<ExportRows['queue']>(
        supabase.from('playing_queue').select('game_id, position').eq('user_id', user.id),
      ),
      read<ExportRows['favorites']>(
        supabase.from('favorite_games').select('game_id, position').eq('user_id', user.id),
      ),
      read<ExportRows['insights']>(
        supabase
          .from('player_insights')
          .select('tone, headline, paragraphs, signature, generated_at')
          .eq('user_id', user.id)
          .order('tone'),
      ),
      read<ExportRows['sharePages']>(
        service
          .from('shared_completions')
          .select('id, game_name, rating, playtime_minutes, created_at')
          .eq('user_id', user.id)
          .order('created_at'),
      ),
      read<ExportRows['supportMessages']>(
        service
          .from('support_tickets')
          .select('type, message, created_at')
          .eq('user_id', user.id)
          .order('created_at'),
      ),
      // It grows with every change to a game, so it's read in pages too.
      fetchAllRows<ExportRows['history'][number]>((from, to) =>
        supabase
          .from('game_events')
          .select('game_id, kind, changes, created_at')
          .eq('user_id', user.id)
          .order('id')
          .range(from, to),
      ),
      // One for every pick made, so in pages as well.
      fetchAllRows<ExportRows['picks'][number]>((from, to) =>
        supabase
          .from('game_picks')
          .select(
            'game_id, kind, mode, mood, energy, time, attempt, reasoning, model, outcome, created_at, answered_at',
          )
          .eq('user_id', user.id)
          .order('id')
          .range(from, to),
      ),
    ]);
    rows = {
      account: {
        email: user.email ?? null,
        createdAt: user.created_at ?? null,
        displayName: profile?.display_name ?? null,
        username: profile?.username ?? null,
        steamId: profile?.steam_id ?? null,
        steamUsername: profile?.steam_username ?? null,
      },
      games,
      queue: queue ?? [],
      favorites: favorites ?? [],
      insights: insights ?? [],
      sharePages: sharePages ?? [],
      supportMessages: supportMessages ?? [],
      history,
      picks,
    };
  } catch (error) {
    // All of it or none: a file missing a part would pass for a full copy.
    console.error('Reading the data to export failed:', error);
    return jsonError(FAILED, 500);
  }

  const now = new Date();
  const data = buildExport(rows, now);
  const body = format === 'csv' ? gamesCsv(data.games) : `${JSON.stringify(data, null, 2)}\n`;
  return new NextResponse(body, {
    headers: {
      'Content-Type':
        format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFileName(format, now)}"`,
      // The player's own data: never kept by a cache on the way.
      'Cache-Control': 'private, no-store',
    },
  });
}
