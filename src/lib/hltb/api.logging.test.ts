/**
 * @jest-environment node
 */
// What reaches Sentry is what's logged with console.error on the server, so
// one game's failed lookup is a warning, and only signs that HLTB itself
// changed or is shutting us out are errors.
export {};

type HltbModule = typeof import('@/lib/hltb/api');

const timedOut = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

/** HLTB whose init and search answer as given. */
function mockHltb({
  init = () => new Response(JSON.stringify({ token: 't' })),
  search,
}: {
  init?: () => Response;
  search: () => Response;
}) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, request?: RequestInit) => {
    const url = String(input);
    if (url.includes('/init')) return init();
    if (request?.method === 'POST') return search();
    // The site's bundle, where the search endpoint is found.
    if (url.endsWith('.js')) {
      return new Response(`fetch("/api/search/site",{method:"POST",body:x})`);
    }
    return new Response('<script src="/_next/static/chunks/app.js"></script>');
  }) as typeof fetch;
}

function loadHltb(): HltbModule {
  let mod!: HltbModule;
  jest.isolateModules(() => {
    mod = jest.requireActual('@/lib/hltb/api');
  });
  return mod;
}

let errors: jest.SpyInstance;
let warnings: jest.SpyInstance;
beforeEach(() => {
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  warnings = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("warns, and reports nothing, when one game's search times out", async () => {
  mockHltb({
    search: () => {
      throw timedOut();
    },
  });
  await expect(loadHltb().getMainStoryHours('Celeste')).resolves.toBeNull();
  expect(warnings).toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
});

it("warns, and reports nothing, when one game's search fails", async () => {
  mockHltb({ search: () => new Response('', { status: 500 }) });
  await expect(loadHltb().getMainStoryHours('Celeste')).resolves.toBeNull();
  expect(warnings).toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
});

it('warns, and reports nothing, when getting a token times out', async () => {
  mockHltb({
    init: () => {
      throw timedOut();
    },
    search: () => new Response(JSON.stringify({ data: [] })),
  });
  await loadHltb().getMainStoryHours('Celeste');
  expect(warnings).toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
});

it('reports it when HLTB stops handing out tokens, which means its site changed', async () => {
  mockHltb({
    init: () => new Response(JSON.stringify({})),
    search: () => new Response(JSON.stringify({ data: [] })),
  });
  await loadHltb().getMainStoryHours('Celeste');
  expect(errors).toHaveBeenCalledWith('[HLTB] Init response missing token');
});

it('reports it when HLTB refuses us even with a fresh token', async () => {
  mockHltb({ search: () => new Response('', { status: 403 }) });
  await loadHltb().getMainStoryHours('Celeste');
  expect(errors).toHaveBeenCalledWith('[HLTB] 403 Forbidden for "Celeste" even with a fresh token');
});
