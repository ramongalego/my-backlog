import { z } from 'zod';
import { MAX_FAVORITES } from '@/lib/account/favorites';
import { cleanUsername, usernameProblem } from '@/lib/account/username';
import { gameIdSchema, safeText } from './common';

export const MAX_NAME_LENGTH = 40;

/** Empty or null means none: the profile goes back to the Steam name, or the email before its @. */
export const profileNameSchema = z.object({
  name: safeText
    // Characters that draw nothing (zero-width, direction marks, the Hangul
    // filler) go first, so a name can't be made only of them.
    .transform((name) =>
      name
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u3164\uFEFF]/g, '')
        // An accent joins its letter where it can, so it isn't counted below.
        .normalize('NFC')
        // "Glitch text": marks stacked on one letter until they spill over the
        // lines around it. Four is more than any writing stacks.
        .replace(/(\p{M}{4})\p{M}+/gu, '$1')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .refine((name) => !/[\u0000-\u001f\u007f]/.test(name), 'That name has characters it can’t show')
    .refine((name) => name.length <= MAX_NAME_LENGTH, `Keep it to ${MAX_NAME_LENGTH} characters`)
    .nullable()
    .transform((name) => name || null),
});

/** Cleaned (capitals lowered), then held to the rule; taken and reserved are the database's to say. */
export const usernameSchema = z.object({
  username: z
    .string('Enter a username')
    .transform(cleanUsername)
    .superRefine((username, context) => {
      const problem = usernameProblem(username);
      if (problem) context.addIssue({ code: 'custom', message: problem });
    }),
});

export const favoriteGamesSchema = z.object({
  gameIds: z
    .array(gameIdSchema)
    .max(MAX_FAVORITES, `Pick ${MAX_FAVORITES} games at most`)
    .refine((ids) => new Set(ids).size === ids.length, 'Each game can be picked once'),
});
