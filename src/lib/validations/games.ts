import { z } from 'zod';
import { ADD_STATUSES, BULK_STATUSES, GAME_STATUSES, MAX_BULK_CHANGES } from '@/lib/games/status';
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
  // Moving the game being played to the queue: with status backlog, it also
  // goes to the top of the queue, in the same save.
  queueAtTop: z.boolean().optional(),
});

export type GameStatusBody = z.infer<typeof gameStatusSchema>;

// Several games moved at once (Games, Select): each with the status it goes
// to and, for Undo, the date, rating and notes it had.
export const bulkStatusSchema = z.object({
  changes: z
    .array(
      gameStatusSchema
        .pick({ gameId: true, finishedAt: true, droppedAt: true, notes: true, rating: true })
        .extend({ status: z.enum(BULK_STATUSES) }),
    )
    .min(1)
    .max(MAX_BULK_CHANGES, `No more than ${MAX_BULK_CHANGES} games at once`),
});

// A bulk change's Undo: each game with the status and details it had, to be
// written back as they were.
export const bulkRestoreSchema = z.object({
  restore: z
    .array(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(BULK_STATUSES),
        started_at: isoDate.nullable(),
        finished_at: isoDate.nullable(),
        dropped_at: isoDate.nullable(),
        notes: z.string().max(1000).nullable(),
        rating: z.number().int().min(0).max(10).nullable(),
        last_played_at: isoDate.nullable(),
      }),
    )
    .min(1)
    .max(MAX_BULK_CHANGES, `No more than ${MAX_BULK_CHANGES} games at once`),
});

// Choosing a game's art: the image picked, or null for the original.
export const gameArtSchema = z.object({
  gameId: z.number().int().positive(),
  url: z.string().url().max(500).nullable(),
});

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
