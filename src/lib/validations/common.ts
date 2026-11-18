import { z } from 'zod';
import { MAX_BULK_APP_IDS, MAX_HLTB_APP_IDS } from '@/lib/games/sync-limits';

/** Only what could be a tag goes ("<b>", "</p>", "<!--"), so "I <3 it, and 2 > 1" stays whole. */
export const safeText = z
  .string()
  .transform((val) => val.replace(/<(?:\/?[a-z]|!)[^>]*>/gi, '').trim());

// Steam app ids are 32-bit; anything larger would fail in the database.
const appIdSchema = z.number().int().positive().max(2_147_483_647);

/** A game's row id (games.id). */
export const gameIdSchema = z.number().int().positive();

/** A kept pick's id (game_picks.id). */
export const pickIdSchema = z.number().int().positive();

export const syncSingleRequestSchema = z.object({
  appId: appIdSchema,
  name: z.string().trim().min(1).max(500).optional(),
});

export const syncBulkRequestSchema = z.object({
  appIds: z.array(appIdSchema).min(1).max(MAX_BULK_APP_IDS),
});

export const syncHltbRequestSchema = z.object({
  appIds: z.array(appIdSchema).min(1).max(MAX_HLTB_APP_IDS),
});

export const queueAddRequestSchema = z.object({
  gameId: gameIdSchema,
  // An Undo of taking the game off the queue: ms since then (see undoAgoMs in games.ts).
  undoAgoMs: z.number().min(0).optional(),
});

export const rerollRequestSchema = z.object({
  gameId: gameIdSchema,
  /** The kept pick being passed on (game_picks.id), when it was kept. */
  pickId: pickIdSchema.optional(),
});

export const queueReorderRequestSchema = z.object({
  order: z.array(gameIdSchema).min(1).max(MAX_BULK_APP_IDS),
});

/** The first issue for each field, as the form shows them under its fields. */
export function issuesByField<F extends string>(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Partial<Record<F, string>> {
  const byField: Partial<Record<F, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0] as F;
    byField[field] ??= issue.message;
  }
  return byField;
}
