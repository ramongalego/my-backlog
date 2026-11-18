// The browser's reports reach Sentry through this site (`tunnelRoute` in
// next.config.ts), so ad blockers don't drop them. This handler sends on the
// report alone: not the player's cookies, headers or IP address.
export { POST } from '@sentry/nextjs/tunnel';
