import type { ErrorEvent } from '@sentry/nextjs';

/** Longer than any message worth reading in a title. */
const MAX_OBJECT = 300;

/** A logged value as words: an error (Supabase's are plain objects) by its message and code. */
function describe(value: unknown): string {
  if (value === null || typeof value !== 'object') return String(value);
  const { message, code } = value as { message?: unknown; code?: unknown };
  if (typeof message === 'string' && message) {
    return typeof code === 'string' && code ? `${message} (${code})` : message;
  }
  const json = JSON.stringify(value);
  return json.length > MAX_OBJECT ? `${json.slice(0, MAX_OBJECT)}…` : json;
}

/**
 * A `console.error` the server logged without an Error in it (most catches
 * log Supabase's error, a plain object) reaches Sentry with each object turned
 * into "[object Object]", and titled by the minified function it was logged
 * in ("o"). The logged values are still in `extra.arguments`, so the message
 * is said again from them, and the issue is titled by it. Run after
 * scrubEvent, so it is built from what that let through.
 */
export function readableConsoleEvent(event: ErrorEvent): ErrorEvent {
  if (event.logger !== 'console') return event;
  const logged = event.extra?.arguments;
  const message = Array.isArray(logged) ? logged.map(describe).join(' ') : event.message;
  if (Array.isArray(logged) && typeof event.message === 'string') event.message = message;

  const values = event.exception?.values;
  const synthetic = values?.length === 1 && values[0].mechanism?.synthetic;
  if (!values || !synthetic || !message) return event;
  // Not synthetic, Sentry titles the issue "Error: <message>" rather than by
  // the function; it still groups by where it was logged.
  event.exception = {
    ...event.exception,
    values: [
      {
        ...values[0],
        type: 'Error',
        value: message,
        mechanism: { ...values[0].mechanism!, synthetic: false },
      },
    ],
  };
  return event;
}
