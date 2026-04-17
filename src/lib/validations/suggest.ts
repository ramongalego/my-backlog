import { z } from 'zod';

export const MAX_EXCLUDE_APP_IDS = 200;
export const MAX_PREVIOUS_REASONINGS = 5;
export const MAX_REASONING_LENGTH = 500;

export const suggestRequestSchema = z.object({
  mood: z.enum(['adrenaline', 'relaxed', 'engaged', 'emotional']),
  energy: z.enum(['high', 'medium', 'low']),
  time: z.enum(['short', 'medium', 'long']),
  excludeAppIds: z
    .array(z.number().int().positive())
    .max(MAX_EXCLUDE_APP_IDS)
    .optional()
    .default([]),
  previousReasonings: z
    .array(z.string().transform((r) => r.slice(0, MAX_REASONING_LENGTH)))
    .max(MAX_PREVIOUS_REASONINGS)
    .optional()
    .default([]),
});

export type SuggestRequestBody = z.infer<typeof suggestRequestSchema>;
