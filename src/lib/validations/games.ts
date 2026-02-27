import { z } from 'zod';

// Strips HTML tags and trims whitespace to prevent stored XSS
const safeText = z.string().transform((val) => val.replace(/<[^>]*>/g, '').trim());

const validStatuses = ['backlog', 'playing', 'finished', 'dropped', 'hidden'] as const;

export const gameStatusSchema = z.object({
  appId: z.number().int().positive(),
  status: z.enum(validStatuses),
  finishedAt: z.string().optional(),
  droppedAt: z.string().optional(),
  notes: safeText
    .pipe(z.string().max(1000, 'Notes must be 1000 characters or fewer'))
    .optional()
    .nullable(),
  rating: z.number().int().min(0).max(10).optional().nullable(),
});

export type GameStatusBody = z.infer<typeof gameStatusSchema>;
