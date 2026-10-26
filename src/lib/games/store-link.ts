/** The game's Steam store page, or null for a game that isn't from Steam. */
export function steamStoreUrl(appId: number | null | undefined): string | null {
  return appId ? `https://store.steampowered.com/app/${appId}/` : null;
}
