// Shared by the proxy (turns signed-out visitors away), the browser (leaves when
// its session is gone) and robots.txt (keeps search engines out).

export const PROTECTED_ROUTES = [
  '/home',
  '/games',
  '/diary',
  '/stats',
  '/playing-queue',
  '/profile',
  '/settings',
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}
