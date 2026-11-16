/** Where connecting Steam starts, saying which page to come back to. */
export function steamConnectUrl(page: { pathname: string; search: string }): string {
  return `/api/steam/auth?from=${encodeURIComponent(`${page.pathname}${page.search}`)}`;
}

/** Starts linking a Steam account to the signed-in one. */
export function connectSteam() {
  // Full-page navigation is intentional: this route handler 307s to steamcommunity.com
  // (OpenID), which a client-side router.push() cannot follow.
  window.location.href = steamConnectUrl(window.location);
}
