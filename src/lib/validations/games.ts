import { z } from 'zod';
import { ADD_STATUSES, GAME_STATUSES } from '@/lib/games/status';
import { safeText } from './common';

// A calendar date ("2025-08-20") or a full timestamp as Postgres returns it.
// Partial matches like "2024-13-99xyz" used to pass and then fail in Postgres.
const isoDate = z.union([z.iso.date(), z.iso.datetime({ offset: true, local: true })], {
  error: 'Invalid date format',
});

export const gameStatusSchema = z.object({
  gameId: z.number().int().positive(),
  status: z.enum(GAME_STATUSES),
  finishedAt: isoDate.optional(),
  droppedAt: isoDate.optional(),
  notes: safeText
    .pipe(z.string().max(1000, 'Notes must be 1000 characters or fewer'))
    .optional()
    .nullable(),
  rating: z.number().int().min(0).max(10).optional().nullable(),
  // Starting a game while another is playing: the other one is paused (top of
  // the queue, start date kept) instead of going back to the backlog.
  pausePlaying: z.boolean().optional(),
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
  status: z.enum(ADD_STATUSES),
  hoursPlayed: hoursPlayed.optional(),
  date: isoDate.optional(),
  notes: gameStatusSchema.shape.notes,
  rating: gameStatusSchema.shape.rating,
});

// Either the hours played on the console, or moving a Steam game back to Steam.
export const updateManualGameSchema = z.union([
  z.object({ hoursPlayed }),
  z.object({ playOnSteam: z.literal(true) }),
]);
