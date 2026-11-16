// Which pages are for signed-in players. Shared by the proxy, which turns
// signed-out visitors away from them, and the browser, which leaves them when
// it finds its session is gone. Safe to import anywhere.

const PROTECTED_ROUTES = ['/home', '/games', '/diary', '/stats', '/playing-queue', '/profile'];

/** Whether a path is one of the signed-in pages (or under one). */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}
