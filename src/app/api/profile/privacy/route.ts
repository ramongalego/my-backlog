import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { saveProfileSetting } from '@/lib/server/profile-setting';

/**
 * Whether the player's profile can be seen by other people (/u/<username>).
 * The page reads it afresh on every visit, so a profile made private is gone
 * for visitors at once.
 */
export function PUT(request: NextRequest) {
  return saveProfileSetting(request, {
    schema: z.object({ private: z.boolean() }),
    toRow: (body) => ({ is_private: body.private }),
    what: 'the profile visibility',
  });
}
