export function reloadPage(): void {
  window.location.reload();
}

/**
 * Reloads after signing in or out, which also changes the page (the landing
 * page becomes Home, and back). A reload keeps the scroll position, so you'd
 * land partway down the new page once its rows load in: start from the top.
 */
export function reloadAtTop(): void {
  window.scrollTo(0, 0);
  window.location.reload();
}
