// Who a player is on their Profile page, from what the account already has:
// a Steam name and avatar when Steam is connected, the email they signed up
// with, and when they joined.

/**
 * The name the profile shows: the Steam name when Steam is connected,
 * otherwise the part of the email before the @ (the whole address isn't a
 * name, and is nobody else's to read once profiles can be seen by others).
 */
export function displayName(
  steamUsername: string | null | undefined,
  email: string | null | undefined,
): string {
  const steam = steamUsername?.trim();
  if (steam) return steam;
  const local = email?.split('@')[0]?.trim();
  return local || 'Player';
}

/** The letter drawn in place of an avatar. */
export function initialOf(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

/** "March 2026" from when the account was made, or null when that isn't known. */
export function memberSince(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
