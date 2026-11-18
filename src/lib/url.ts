/**
 * Anywhere but Vercel's production deployment (local development too), the
 * production address. A domain of its own, when there is one, goes here.
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'https://my-backlog-chi.vercel.app';
}
