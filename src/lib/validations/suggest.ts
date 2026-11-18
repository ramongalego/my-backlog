import { z } from 'zod';
import { gameIdSchema, pickIdSchema } from './common';

const MAX_EXCLUDE_GAME_IDS = 200;
/** How many earlier picks' reasons a reroll sends along (so the next isn't worded the same). */
export const MAX_PREVIOUS_REASONINGS = 5;
const MAX_REASONING_LENGTH = 500;
// Far more rolls than anyone makes in one sitting.
const MAX_PICK_ATTEMPT = 10_000;

/** `queue` while a game is being played: the pick waits its turn. */
const pickModeSchema = z.enum(['play', 'queue']);
/** `unseen`: the picker was closed before the pick arrived. */
const pickOutcomeValueSchema = z.enum(['played', 'queued', 'rerolled', 'unseen']);

export const suggestRequestSchema = z.object({
  mood: z.enum(['adrenaline', 'relaxed', 'engaged', 'emotional']),
  energy: z.enum(['high', 'medium', 'low']),
  time: z.enum(['short', 'medium', 'long']),
  // Kept with the pick (game_picks); it doesn't change which game is picked.
  mode: pickModeSchema.optional().default('play'),
  excludeGameIds: z
    .array(z.number().int().positive())
    .max(MAX_EXCLUDE_GAME_IDS)
    .optional()
    .default([]),
  previousReasonings: z
    .array(z.string().transform((r) => r.slice(0, MAX_REASONING_LENGTH)))
    .max(MAX_PREVIOUS_REASONINGS)
    .optional()
    .default([]),
});

/** A random pick the browser made, to be kept (POST /api/suggest/picks). */
export const randomPickSchema = z.object({
  gameId: gameIdSchema,
  mode: pickModeSchema,
  /** Which pick of the sitting: 1, then 2 after one roll again, and so on. */
  attempt: z.number().int().min(1).max(MAX_PICK_ATTEMPT),
  // Home's Random starts its game at once, so the pick and the choice arrive together.
  outcome: z.literal('played').optional(),
});

/** What the player did with a pick, to be kept with it (PATCH /api/suggest/picks). */
export const pickOutcomeSchema = z.object({
  pickId: pickIdSchema,
  outcome: pickOutcomeValueSchema,
});
