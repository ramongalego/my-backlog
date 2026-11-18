/**
 * Only the part of the email before the @: the whole address isn't a name, and
 * is nobody else's to read once profiles can be seen by others.
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

export function profileName(
  chosen: string | null | undefined,
  steamUsername: string | null | undefined,
  email: string | null | undefined,
): string {
  return chosen?.trim() || displayName(steamUsername, email);
}

export function profileAvatar(
  uploaded: string | null | undefined,
  steamAvatar: string | null | undefined,
): string | null {
  return uploaded || steamAvatar || null;
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
