import { scrubEvent } from '@/lib/sentry/scrub';

/**
 * Vercel's `production` or `preview`, set at build time (next.config.ts). Empty
 * anywhere else, localhost included, and then nothing is sent.
 */
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? '';

/**
 * Errors that say nothing about the app: the player's connection, a request
 * canceled on purpose, a tab still running the code from before a deploy,
 * browser quirks, and Node's deprecation warnings, which it prints with
 * console.error (so the server would report them) and which are about
 * dependencies' code, not ours.
 */
const IGNORED_ERRORS: (string | RegExp)[] = [
  /^(TypeError: )?Failed to fetch/,
  /^(TypeError: )?Load failed$/,
  /^(TypeError: )?NetworkError when attempting to fetch resource/,
  /^(TypeError: )?Network request failed/,
  'The network connection was lost',
  'AbortError',
  'The operation was aborted',
  'signal is aborted without reason',
  'ChunkLoadError',
  /Loading (CSS )?chunk \S+ failed/,
  'Failed to load chunk',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'ResizeObserver loop',
  'Non-Error promise rejection captured',
  /\[DEP\d+\] DeprecationWarning/,
];

/** Code a browser extension put on the page. */
const EXTENSION_URLS = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^safari(-web)?-extension:\/\//,
];

/** Shared by the browser, the server and the edge. No tracing: errors only. */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: environment === 'production' || environment === 'preview',
  environment: environment || 'development',
  sendDefaultPii: false,
  ignoreErrors: IGNORED_ERRORS,
  denyUrls: EXTENSION_URLS,
  beforeSend: scrubEvent,
};
