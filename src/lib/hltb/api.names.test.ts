/**
 * @jest-environment node
 */
export {};

type HltbModule = typeof import('@/lib/hltb/api');

// HowLongToBeat's games, as its search matches them: every search word has
// to be in the title, accents aside. Most popular first, as it sorts them.
const CATALOG: {
  game_name: string;
  comp_main: number;
  release_world?: number;
  game_type?: string;
}[] = [
  // A remake and its original under one title, the remake first.
  { game_name: 'Dead Space', comp_main: 12.2 * 3600, release_world: 2023, game_type: 'game' },
  { game_name: 'Dead Space', comp_main: 11 * 3600, release_world: 2008, game_type: 'game' },
  { game_name: 'Dead Space 2', comp_main: 9.1 * 3600, release_world: 2011, game_type: 'game' },
  // A remake nobody has finished yet, a fan remake, and the original.
  { game_name: 'Star Fable', comp_main: 0, release_world: 2026, game_type: 'game' },
  { game_name: 'Star Fable', comp_main: 3 * 3600, release_world: 2015, game_type: 'hack' },
  { game_name: 'Star Fable', comp_main: 20 * 3600, release_world: 1999, game_type: 'game' },
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
      // Whole words, as HLTB matches them ("Dead Space (2008)" finds nothing).
      const data = CATALOG.filter((game) =>
        searchTerms.every((term) => plain(game.game_name).split(/\W+/).includes(plain(term))),
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

describe('games that share a title (an original and its remake)', () => {
  it("takes HowLongToBeat's first when the year isn't known", async () => {
    mockHltb();
    await expect(loadHltb().getMainStoryHours('Dead Space')).resolves.toBe(12.2);
  });

  it('takes the one from the year the game came out', async () => {
    mockHltb();
    const { getMainStoryHours } = loadHltb();
    await expect(getMainStoryHours('Dead Space', 2008)).resolves.toBe(11);
    await expect(getMainStoryHours('Dead Space', 2023)).resolves.toBe(12.2);
  });

  it('takes the newest one not newer than the game, for a port released later', async () => {
    mockHltb();
    const { getMainStoryHours } = loadHltb();
    // The original, brought to another store in 2012; the remake wasn't out.
    await expect(getMainStoryHours('Dead Space', 2012)).resolves.toBe(11);
    await expect(getMainStoryHours('Dead Space', 2025)).resolves.toBe(12.2);
    // Older than both: nothing to go on, so HLTB's first.
    await expect(getMainStoryHours('Dead Space', 1990)).resolves.toBe(12.2);
  });

  it('goes by the year in the name, over the date it came to the store', async () => {
    const searched = mockHltb();
    // Steam's name for the original, which it has sold since 2014.
    await expect(loadHltb().getMainStoryHours('Dead Space (2008)', 2014)).resolves.toBe(11);
    expect(searched).toEqual([
      ['Dead', 'Space', '2008'],
      ['Dead', 'Space'],
    ]);
  });

  it('leaves the year out of it when only one game has the title', async () => {
    mockHltb();
    await expect(loadHltb().getMainStoryHours('Dead Space 2', 2019)).resolves.toBe(9.1);
  });

  it("gives a remake with no time yet none, not the original's", async () => {
    mockHltb();
    const { getMainStoryHours } = loadHltb();
    await expect(getMainStoryHours('Star Fable', 2026)).resolves.toBeNull();
    await expect(getMainStoryHours('Star Fable', 1999)).resolves.toBe(20);
  });

  it('never takes a fan remake for the game', async () => {
    mockHltb();
    // 2015 is the hack's year; the newest real game before 2016 is the original.
    await expect(loadHltb().getMainStoryHours('Star Fable', 2016)).resolves.toBe(20);
  });

  it('answers for any year from one search (findMainStoryTimes)', async () => {
    const searched = mockHltb();
    const times = await loadHltb().findMainStoryTimes('Dead Space');
    expect([times(2008), times(2023), times(), times(null)]).toEqual([11, 12.2, 12.2, 12.2]);
    expect(searched).toHaveLength(1);
  });
});
