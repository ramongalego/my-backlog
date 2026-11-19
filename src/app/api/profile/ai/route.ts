import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { saveProfileSetting } from '@/lib/server/profile-setting';

/**
 * Whether the player wants the AI features (Pick My Game's questions, the
 * player profile and roast). Off, the routes that call a model refuse
 * (lib/server/ai-features).
 */
export function PUT(request: NextRequest) {
  return saveProfileSetting(request, {
    schema: z.object({ enabled: z.boolean() }),
    // Kept as whether they are off, so a profile that says nothing has them on.
    toRow: (body) => ({ ai_disabled: !body.enabled }),
    what: 'the AI features setting',
  });
}
