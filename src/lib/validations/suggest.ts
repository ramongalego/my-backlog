import { z } from 'zod';

const MAX_EXCLUDE_GAME_IDS = 200;
/** How many earlier picks' reasons a reroll sends along (so the next isn't worded the same). */
export const MAX_PREVIOUS_REASONINGS = 5;
const MAX_REASONING_LENGTH = 500;

export const suggestRequestSchema = z.object({
  mood: z.enum(['adrenaline', 'relaxed', 'engaged', 'emotional']),
  energy: z.enum(['high', 'medium', 'low']),
  time: z.enum(['short', 'medium', 'long']),
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
