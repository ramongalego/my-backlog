import 'server-only';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The accounts that run the app, from OWNER_USER_IDS (comma-separated account
 * ids). Unset or unreadable, there are none: nobody gets the owner's pages.
 */
export function ownerUserIds(): string[] {
  return (process.env.OWNER_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter((id) => UUID.test(id));
}

export function isOwner(userId: string | null | undefined): boolean {
  return !!userId && ownerUserIds().includes(userId.toLowerCase());
}
