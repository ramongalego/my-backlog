import { z } from 'zod';
import { MAX_BULK_APP_IDS, MAX_HLTB_APP_IDS } from '@/lib/games/sync-limits';

// Steam app ids are 32-bit; anything larger would fail in the database.
const appIdSchema = z.number().int().positive().max(2_147_483_647);

/** A game's row id (games.id). */
export const gameIdSchema = z.number().int().positive();

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
});

export const queueReorderRequestSchema = z.object({
  order: z.array(gameIdSchema).min(1).max(MAX_BULK_APP_IDS),
});
