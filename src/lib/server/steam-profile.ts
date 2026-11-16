import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** The Steam name and picture a profile has saved. */
export interface SteamIdentity {
  username: string | null;
  avatar: string | null;
}

/**
 * Saves the player's Steam name and picture when they've changed on Steam
 * since they were saved (at connecting, or the last refresh), so "Connected
 * as" and the profile's fallback name and picture follow Steam. Returns the
 * new ones, or null when nothing changed, Steam said nothing, or they couldn't
 * be saved: then the saved ones stand, and the next refresh tries again.
 */
export async function syncSteamIdentity(
  service: SupabaseClient | null,
  userId: string,
  /** The Steam account the name and picture were read from. */
  steamId: string,
  saved: SteamIdentity,
  summary: { personaname: string; avatarfull: string } | null,
): Promise<SteamIdentity | null> {
  if (!service || !summary) return null;
  const current: SteamIdentity = {
    username: summary.personaname.trim() || null,
    avatar: summary.avatarfull || null,
  };
  // Steam answered without a name: not a reason to lose the one saved.
  if (!current.username) return null;
  if (current.username === saved.username && current.avatar === saved.avatar) return null;

  // Profiles are written by the server only.
  const { error } = await service
    .from('profiles')
    .update({
      steam_username: current.username,
      steam_avatar: current.avatar,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    // Only while that account is still the one linked: a refresh that started
    // before Steam was disconnected, or switched, must not write its name back.
    .eq('steam_id', steamId);
  if (error) {
    console.error('Saving the Steam name and picture failed:', error);
    return null;
  }
  return current;
}
