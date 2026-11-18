/**
 * @jest-environment node
 */

const optionsIn = async (environment: string | undefined) => {
  if (environment === undefined) delete process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
  else process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = environment;
  jest.resetModules();
  return (await import('@/lib/sentry/options')).sentryOptions;
};

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
});

describe('sentryOptions', () => {
  it.each(['production', 'preview'])(
    'sends from a %s deploy, tagged with it',
    async (environment) => {
      expect(await optionsIn(environment)).toMatchObject({ enabled: true, environment });
    },
  );

  it.each([
    ['localhost', undefined],
    ['a build off Vercel', ''],
    ["Vercel's own dev server", 'development'],
  ])('sends nothing from %s', async (_, environment) => {
    expect((await optionsIn(environment)).enabled).toBe(false);
  });

  it('sends no personal data', async () => {
    expect((await optionsIn('production')).sendDefaultPii).toBe(false);
  });

  const ignored = async (message: string) =>
    (await optionsIn('production')).ignoreErrors.some((pattern) =>
      typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message),
    );

  it.each([
    'TypeError: Failed to fetch',
    'TypeError: Load failed',
    'TypeError: NetworkError when attempting to fetch resource.',
    'AbortError: The operation was aborted.',
    'ChunkLoadError: Loading chunk 412 failed.',
    'ResizeObserver loop completed with undelivered notifications.',
  ])('ignores "%s"', async (message) => {
    expect(await ignored(message)).toBe(true);
  });

  it.each([
    "TypeError: Cannot read properties of undefined (reading 'id')",
    'Failed to record a pick: relation "game_picks" does not exist',
    'Load failed for the queue',
  ])('keeps "%s"', async (message) => {
    expect(await ignored(message)).toBe(false);
  });
});
