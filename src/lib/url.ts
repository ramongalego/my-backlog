/**
 * The site's public address: the one Vercel gives the production deployment,
 * or, anywhere else (local development), the address it's deployed at. There
 * is no domain of its own yet; when there is, it goes here.
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'https://my-backlog-chi.vercel.app';
}
