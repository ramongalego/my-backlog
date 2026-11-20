/**
 * @jest-environment node
 */
import type { ErrorEvent } from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry/scrub';

const event = (fields: Partial<ErrorEvent>): ErrorEvent => ({ type: undefined, ...fields });

describe('scrubEvent', () => {
  it('filters auth and IP headers and keeps the rest', () => {
    const { request } = scrubEvent(
      event({
        request: {
          headers: {
            Authorization: 'Bearer abc',
            cookie: 'sb=1',
            'x-forwarded-for': '1.2.3.4',
            'user-agent': 'Firefox',
          },
        },
      }),
    );
    expect(request?.headers).toEqual({
      Authorization: '[Filtered]',
      cookie: '[Filtered]',
      'x-forwarded-for': '[Filtered]',
      'user-agent': 'Firefox',
    });
  });

  it('drops cookies, the body and the query string', () => {
    const { request } = scrubEvent(
      event({
        request: {
          url: 'https://mybacklog.app/auth/callback?code=secret',
          cookies: { sb: '1' },
          data: { note: 'my words' },
          query_string: 'code=secret',
        },
      }),
    );
    expect(request).toEqual({
      url: 'https://mybacklog.app/auth/callback',
      cookies: undefined,
      data: '[Filtered]',
      query_string: '[Filtered]',
      headers: undefined,
    });
  });

  it('filters sensitive fields at any depth of what was logged', () => {
    const { extra } = scrubEvent(
      event({
        extra: {
          arguments: ['Saving failed:', { email: 'a@b.c', game: { id: 7, note: 'mine' } }],
        },
      }),
    );
    expect(extra).toEqual({
      arguments: ['Saving failed:', { email: '[Filtered]', game: { id: 7, note: '[Filtered]' } }],
    });
  });

  it("drops the browser's language and time zone, and keeps the browser and OS", () => {
    const { contexts } = scrubEvent(
      event({
        contexts: {
          culture: { locale: 'en-GB', timezone: 'Europe/London', calendar: 'gregory' },
          browser: { name: 'Chrome' },
          os: { name: 'Windows' },
        },
      }),
    );
    expect(contexts).toEqual({ browser: { name: 'Chrome' }, os: { name: 'Windows' } });
  });

  it('takes the query string off the URLs in breadcrumbs', () => {
    const { breadcrumbs } = scrubEvent(
      event({
        breadcrumbs: [
          { category: 'fetch', data: { url: '/api/games/search?q=zelda', method: 'GET' } },
          { category: 'ui.click', message: 'button' },
        ],
      }),
    );
    expect(breadcrumbs).toEqual([
      { category: 'fetch', data: { url: '/api/games/search', method: 'GET' } },
      { category: 'ui.click', message: 'button' },
    ]);
  });

  it('filters a field by what its name holds, however it is spelled', () => {
    const { extra } = scrubEvent(
      event({
        extra: {
          access_token: 'a',
          refreshToken: 'b',
          new_email: 'c',
          notes: 'd',
          steam_id: '76561198000000000',
          user_id: '28f2ff71-0000-4000-8000-000000000000',
          gameId: 7,
          status: 'finished',
        },
      }),
    );
    expect(extra).toEqual({
      access_token: '[Filtered]',
      refreshToken: '[Filtered]',
      new_email: '[Filtered]',
      notes: '[Filtered]',
      steam_id: '[Filtered]',
      user_id: '[Filtered]',
      gameId: 7,
      status: 'finished',
    });
  });

  it("drops a database error's details, which quote the row, and keeps what went wrong", () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "games_user_app"',
      details: 'Key (user_id, app_id)=(28f2ff71-0000-4000-8000-000000000000, 620) already exists.',
      hint: null,
    };
    const { extra } = scrubEvent(
      event({ extra: { arguments: ['Adding the game failed:', error] } }),
    );
    expect(extra).toEqual({
      arguments: ['Adding the game failed:', { ...error, details: '[Filtered]' }],
    });
    // Details of anything else are left: only a database error's quote a row.
    expect(scrubEvent(event({ extra: { details: 'the art host timed out' } })).extra).toEqual({
      details: 'the art host timed out',
    });
  });

  it('takes email addresses out of the words of an error', () => {
    const scrubbed = scrubEvent(
      event({
        message: 'Changing the email failed: jane.doe+games@example.co.uk is already registered',
        extra: { arguments: ['Auth said:', 'User jane@example.com not found'] },
        exception: { values: [{ type: 'Error', value: 'No account for jane@example.com' }] },
      }),
    );
    expect(scrubbed.message).toBe('Changing the email failed: [Filtered] is already registered');
    expect(scrubbed.extra).toEqual({ arguments: ['Auth said:', 'User [Filtered] not found'] });
    expect(scrubbed.exception?.values?.[0].value).toBe('No account for [Filtered]');
  });

  it('says a profile or a share page was open, not whose', () => {
    const scrubbed = scrubEvent(
      event({
        transaction: '/u/mistkai',
        request: {
          url: 'https://mybacklog.co/u/mistkai#profile-activity',
          headers: { referer: 'https://mybacklog.co/share/completion/V1StGXR8_Z5jdHi6B-myT?x=1' },
        },
        breadcrumbs: [
          { category: 'navigation', data: { from: '/home', to: '/u/mistkai' } },
          { category: 'fetch', data: { url: '/api/og/completion/V1StGXR8_Z5jdHi6B-myT' } },
        ],
      }),
    );
    expect(scrubbed.transaction).toBe('/u/[username]');
    expect(scrubbed.request?.url).toBe('https://mybacklog.co/u/[username]');
    expect(scrubbed.request?.headers).toEqual({
      referer: 'https://mybacklog.co/share/completion/[id]',
    });
    expect(scrubbed.breadcrumbs).toEqual([
      { category: 'navigation', data: { from: '/home', to: '/u/[username]' } },
      { category: 'fetch', data: { url: '/api/og/completion/[id]' } },
    ]);
  });

  it('leaves an event with nothing to scrub as it is', () => {
    const plain = event({ message: 'Something broke' });
    expect(scrubEvent(plain)).toEqual({ type: undefined, message: 'Something broke' });
  });
});
