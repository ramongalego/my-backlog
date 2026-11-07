/**
 * @jest-environment node
 */
type HltbModule = typeof import('@/lib/hltb/api');

/** HLTB with a token, whose search answers `searchStatus()`. Counts searches. */
function mockHltb(searchStatus: () => number) {
  let searches = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/init')) return new Response(JSON.stringify({ token: 't' }));
    if (init?.method === 'POST') {
      searches++;
      const status = searchStatus();
      return status === 200
        ? new Response(JSON.stringify({ data: [{ comp_main: 36000 }] }))
        : new Response('', { status });
    }
    return new Response('<html></html>'); // no chunks: falls back to the known endpoint
  }) as typeof fetch;
  return () => searches;
}

function loadHltb(): HltbModule {
  let mod!: HltbModule;
  jest.isolateModules(() => {
    mod = jest.requireActual('@/lib/hltb/api');
  });
  return mod;
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

it('finds the main story time', async () => {
  mockHltb(() => 200);
  await expect(loadHltb().getMainStoryHours('Celeste')).resolves.toBe(10);
});

it('reports a rate limit as "unavailable", not as "no time"', async () => {
  mockHltb(() => 429);
  const { getMainStoryHours, HLTBUnavailableError } = loadHltb();
  await expect(getMainStoryHours('Celeste')).rejects.toBeInstanceOf(HLTBUnavailableError);
});

it('stops sending searches for a while once blocked', async () => {
  let status = 429;
  const searches = mockHltb(() => status);
  const { getMainStoryHours, HLTBUnavailableError } = loadHltb();
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(1_000_000);

  await expect(getMainStoryHours('A')).rejects.toBeInstanceOf(HLTBUnavailableError);
  status = 200;
  await expect(getMainStoryHours('B')).rejects.toBeInstanceOf(HLTBUnavailableError);
  expect(searches()).toBe(1);

  now.mockReturnValue(1_000_000 + 31_000);
  await expect(getMainStoryHours('C')).resolves.toBe(10);
  expect(searches()).toBe(2);
});

it('still treats other failures as "no time"', async () => {
  mockHltb(() => 500);
  await expect(loadHltb().getMainStoryHours('Celeste')).resolves.toBeNull();
});
