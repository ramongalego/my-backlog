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

  it('leaves an event with nothing to scrub as it is', () => {
    const plain = event({ message: 'Something broke' });
    expect(scrubEvent(plain)).toEqual({ type: undefined, message: 'Something broke' });
  });
});
