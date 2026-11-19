'use client';

import { useAuth } from './useAuth';

/**
 * Whether to offer the AI features (Pick My Game's questions, the player
 * profile and roast): on unless the player turned them off on Settings. It
 * comes with the session, so nothing is offered and then taken away.
 */
export function useAiFeatures(): boolean {
  const { profile } = useAuth();
  return !profile?.ai_disabled;
}
