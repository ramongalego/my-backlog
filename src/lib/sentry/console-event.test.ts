/**
 * @jest-environment node
 */
import type { ErrorEvent } from '@sentry/nextjs';
import { readableConsoleEvent } from '@/lib/sentry/console-event';
import { sentryOptions } from '@/lib/sentry/options';

const frames = [{ function: 'o', filename: 'app:///_next/server/chunks/route.js', in_app: true }];

/** As the SDK sends `console.error(text, ...values)` with no Error among them. */
const logged = (...args: unknown[]): ErrorEvent => {
  const message = args.map(String).join(' ');
  return {
    type: undefined,
    logger: 'console',
    message,
    extra: { arguments: args },
    exception: {
      values: [
        {
          value: message,
          stacktrace: { frames },
          mechanism: { type: 'auto.core.capture_console', handled: true, synthetic: true },
        },
      ],
    },
  };
};

describe('readableConsoleEvent', () => {
  it("says a Supabase error's message, and titles the issue by it", () => {
    const event = readableConsoleEvent(
      logged('Saving the profile visibility failed:', { message: 'Internal server error.' }),
    );
    const text = 'Saving the profile visibility failed: Internal server error.';
    expect(event.message).toBe(text);
    expect(event.exception?.values?.[0]).toMatchObject({
      type: 'Error',
      value: text,
      stacktrace: { frames },
      mechanism: { type: 'auto.core.capture_console', handled: true, synthetic: false },
    });
  });

  it('adds the error code when there is one', () => {
    const event = readableConsoleEvent(
      logged('Reading the library failed:', {
        message: 'canceling statement due to statement timeout',
        code: '57014',
        details: null,
        hint: null,
      }),
    );
    expect(event.message).toBe(
      'Reading the library failed: canceling statement due to statement timeout (57014)',
    );
  });

  it('writes out an object with no message, cut short when long', () => {
    expect(readableConsoleEvent(logged('Odd answer:', { status: 555 })).message).toBe(
      'Odd answer: {"status":555}',
    );
    const long = readableConsoleEvent(logged({ text: 'x'.repeat(400) })).message!;
    expect(long).toHaveLength(301);
    expect(long.endsWith('…')).toBe(true);
  });

  it('titles a plain logged sentence by its words too', () => {
    const event = readableConsoleEvent(logged('Steam answered', 503, 'for the library'));
    expect(event.message).toBe('Steam answered 503 for the library');
    expect(event.exception?.values?.[0]).toMatchObject({
      type: 'Error',
      value: 'Steam answered 503 for the library',
    });
  });

  it("leaves a thrown error and anything that isn't a console log as they are", () => {
    const thrown: ErrorEvent = {
      type: undefined,
      logger: 'console',
      extra: { arguments: [{ name: 'Error', message: 'boom' }] },
      exception: {
        values: [
          { type: 'TypeError', value: 'boom', mechanism: { type: 'generic', handled: true } },
        ],
      },
    };
    expect(readableConsoleEvent(structuredClone(thrown))).toEqual(thrown);
    const uncaught: ErrorEvent = { type: undefined, message: 'x [object Object]' };
    expect(readableConsoleEvent({ ...uncaught })).toEqual(uncaught);
  });

  it('is built from what the scrub let through', () => {
    const event = sentryOptions.beforeSend(
      logged('Signing in failed:', { status: 401, token: 'abc123' }),
    );
    expect(event.message).toBe('Signing in failed: {"status":401,"token":"[Filtered]"}');
  });
});
