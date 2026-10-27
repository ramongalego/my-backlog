/**
 * @jest-environment node
 */
export {};

type HltbModule = typeof import('@/lib/hltb/api');

// HowLongToBeat's games, as its search matches them: every search word has
// to be in the title, accents aside. Most popular first, as it sorts them.
const CATALOG = [
  { game_name: 'Pokémon Omega Ruby and Alpha Sapphire', comp_main: 25.7 * 3600 },
  { game_name: 'Pokémon Ruby and Sapphire', comp_main: 34.9 * 3600 },
  { game_name: 'Pokémon FireRed and LeafGreen', comp_main: 29.4 * 3600 },
  { game_name: 'Ōkami HD', comp_main: 32.7 * 3600 },
];
const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** HLTB with a token, whose search answers from CATALOG. Records the terms searched. */
function mockHltb() {
  const searched: string[][] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/init')) return new Response(JSON.stringify({ token: 't' }));
    if (init?.method === 'POST') {
      const { searchTerms } = JSON.parse(String(init.body)) as { searchTerms: string[] };
      searched.push(searchTerms);
      const data = CATALOG.filter((game) =>
        searchTerms.every((term) => plain(game.game_name).includes(plain(term))),
      );
      return new Response(JSON.stringify({ data }));
    }
    return new Response('<html></html>'); // no chunks: falls back to the known endpoint
  }) as typeof fetch;
  return searched;
}

function loadHltb(): HltbModule {
  let mod!: HltbModule;
  jest.isolateModules(() => {
    mod = jest.requireActual('@/lib/hltb/api');
  });
  return mod;
}

afterEach(() => jest.restoreAllMocks());

it('searches accented names without their accents, not split apart', async () => {
  const searched = mockHltb();
  await expect(loadHltb().getMainStoryHours('Ōkami HD')).resolves.toBe(32.7);
  expect(searched[0]).toEqual(['Okami', 'HD']);
});

it('finds a Pokémon "Version" under the pair HowLongToBeat lists it as', async () => {
  mockHltb();
  await expect(loadHltb().getMainStoryHours('Pokémon FireRed Version')).resolves.toBe(29.4);
});

it('takes the original pair over a remake that shares its words', async () => {
  mockHltb();
  // "Pokemon Ruby" also matches Omega Ruby, which HLTB lists first.
  await expect(loadHltb().getMainStoryHours('Pokémon Ruby Version')).resolves.toBe(34.9);
});
