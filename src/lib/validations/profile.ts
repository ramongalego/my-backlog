import { z } from 'zod';
import { MAX_FAVORITES } from '@/lib/account/favorites';
import { gameIdSchema } from './common';

/** The games picked as favorites, in order: up to four, each once. */
export const favoriteGamesSchema = z.object({
  gameIds: z
    .array(gameIdSchema)
    .max(MAX_FAVORITES, `Pick ${MAX_FAVORITES} games at most`)
    .refine((ids) => new Set(ids).size === ids.length, 'Each game can be picked once'),
});
