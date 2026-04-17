import { z } from 'zod';

// Cap the input length defensively — a Steam URL or username never needs more
// than ~200 chars, and an oversized body would only be an attempt to exhaust
// the downstream regex matcher or vanity lookup.
export const MAX_STEAM_INPUT_LENGTH = 256;

export const roastRequestSchema = z.object({
  steamInput: z
    .string()
    .trim()
    .min(1, 'Steam URL or username is required')
    .max(MAX_STEAM_INPUT_LENGTH, 'Input too long'),
});

export type RoastRequestBody = z.infer<typeof roastRequestSchema>;
