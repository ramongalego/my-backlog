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
  gameId: z.number().int().positive(),
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

// ─── Games added by hand ─────────────────────────────────────────────────────

// Hours you've played, entered yourself (consoles don't report playtime).
const hoursPlayed = z.number().min(0).max(100000);

export const gameSearchSchema = z.string().trim().min(2).max(100);

export const addManualGameSchema = z.object({
  igdbId: z.number().int().positive(),
  platform: safeText.pipe(z.string().min(1).max(60)),
  // Finished and dropped log a game you've already played, with when and how it went.
  status: z.enum(['backlog', 'queue', 'playing', 'finished', 'dropped']),
  hoursPlayed: hoursPlayed.optional(),
  date: isoDate.optional(),
  notes: gameStatusSchema.shape.notes,
  rating: gameStatusSchema.shape.rating,
});

export type AddManualGameBody = z.infer<typeof addManualGameSchema>;

export const updateManualGameSchema = z.object({ hoursPlayed });
