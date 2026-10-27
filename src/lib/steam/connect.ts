/** Starts linking a Steam account to the signed-in one. */
export function connectSteam() {
  // Full-page navigation is intentional: this route handler 307s to steamcommunity.com
  // (OpenID), which a client-side router.push() cannot follow.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/api/steam/auth';
}
