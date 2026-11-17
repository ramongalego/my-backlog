import { z } from 'zod';
import { MAX_BULK_APP_IDS, MAX_HLTB_APP_IDS } from '@/lib/games/sync-limits';

/**
 * Text a user typed, with HTML tags taken out and the ends trimmed. Only what
 * could be a tag goes ("<b>", "</p>", "<!--"): "I <3 it, and 2 > 1" is kept
 * whole, where taking out everything between "<" and ">" lost the middle.
 */
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
});

export const rerollRequestSchema = z.object({
  gameId: gameIdSchema,
  /** The kept pick being passed on (game_picks.id), when it was kept. */
  pickId: pickIdSchema.optional(),
});

export const queueReorderRequestSchema = z.object({
  order: z.array(gameIdSchema).min(1).max(MAX_BULK_APP_IDS),
});

/**
 * A form's validation issues as one message per field, the first for each, as
 * the form shows them under its fields.
 */
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
