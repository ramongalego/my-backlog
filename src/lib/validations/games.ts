import { z } from 'zod';

// Strips HTML tags and trims whitespace to prevent stored XSS
const safeText = z.string().transform((val) => val.replace(/<[^>]*>/g, '').trim());

// A calendar date ("2025-08-20") or a full timestamp as Postgres returns it.
// Partial matches like "2024-13-99xyz" used to pass and then fail in Postgres.
const isoDate = z.union([z.iso.date(), z.iso.datetime({ offset: true, local: true })], {
  error: 'Invalid date format',
});

const validStatuses = ['backlog', 'playing', 'finished', 'dropped', 'wont_play', 'hidden'] as const;

export const gameStatusSchema = z.object({
  appId: z.number().int().positive(),
  status: z.enum(validStatuses),
  finishedAt: isoDate.optional(),
  droppedAt: isoDate.optional(),
  notes: safeText
    .pipe(z.string().max(1000, 'Notes must be 1000 characters or fewer'))
    .optional()
    .nullable(),
  rating: z.number().int().min(0).max(10).optional().nullable(),
});

export type GameStatusBody = z.infer<typeof gameStatusSchema>;
