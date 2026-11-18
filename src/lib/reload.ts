/**
 * Signing in or out changes the page (landing becomes Home, and back), and a
 * reload keeps the scroll position, so the new page would open partway down.
 */
export function reloadAtTop(): void {
  window.scrollTo(0, 0);
  window.location.reload();
}
