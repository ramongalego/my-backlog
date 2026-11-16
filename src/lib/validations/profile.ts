import { z } from 'zod';
import { MAX_FAVORITES } from '@/lib/account/favorites';
import { gameIdSchema, safeText } from './common';

/** The longest name a profile takes. */
export const MAX_NAME_LENGTH = 40;

/**
 * A name the player chose: tags taken out, spaces run together, trimmed.
 * Empty, or null, means none (the profile goes back to the Steam name, or the
 * email before its @).
 */
export const profileNameSchema = z.object({
  name: safeText
    // Characters that draw nothing (zero-width, direction marks, the Hangul
    // filler) go first, so a name can't be made only of them.
    .transform((name) =>
      name
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u3164\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .refine((name) => !/[\u0000-\u001f\u007f]/.test(name), 'That name has characters it can’t show')
    .refine((name) => name.length <= MAX_NAME_LENGTH, `Keep it to ${MAX_NAME_LENGTH} characters`)
    .nullable()
    .transform((name) => name || null),
});

/** The games picked as favorites, in order: up to four, each once. */
export const favoriteGamesSchema = z.object({
  gameIds: z
    .array(gameIdSchema)
    .max(MAX_FAVORITES, `Pick ${MAX_FAVORITES} games at most`)
    .refine((ids) => new Set(ids).size === ids.length, 'Each game can be picked once'),
});
