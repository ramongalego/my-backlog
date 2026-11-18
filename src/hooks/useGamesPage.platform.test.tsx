import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useGamesPage } from '@/hooks/useGamesPage';
import type { GameItem } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('@/hooks/useQueue', () => ({ useQueue: () => ({ queuedGameIds: new Set<number>() }) }));
jest.mock('@/hooks/useGameMutations', () => ({ useSetGameStatus: () => ({ mutate: jest.fn() }) }));
jest.mock('@/hooks/useBulkStatus', () => ({
  useBulkStatus: () => ({ move: jest.fn(), pending: false }),
}));
jest.mock('@/hooks/useGameDialog', () => ({ useGameDialog: () => () => ({}) }));
// The URL as it is now: the hook writes it with history.replaceState.
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

let nextId = 1;
const game = (overrides: Partial<GameItem> = {}): GameItem => ({
  id: nextId++,
  source: 'manual',
  platform: 'Switch 2',
  app_id: null,
  name: `Game ${nextId}`,
  playtime_forever: 0,
  steam_review_score: null,
  steam_review_count: null,
  critic_score: null,
  critic_count: null,
  steam_review_weighted: null,
  header_image: null,
  main_story_hours: null,
  status: 'backlog',
  notes: null,
  rating: null,
  finished_at: null,
  dropped_at: null,
  tags: null,
  created_at: '2026-01-01T00:00:00Z',
  release_date: null,
  last_played_at: null,
  ...overrides,
});
const steam = (overrides: Partial<GameItem> = {}) =>
  game({ source: 'steam', platform: 'PC', app_id: nextId, ...overrides });

/** The Games page's state for a library, opened at a URL. */
function open(games: GameItem[], query = '') {
  window.history.replaceState(null, '', `/games${query}`);
  const client = new QueryClient();
  client.setQueryData(queryKeys.games.list('user-1'), games);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useGamesPage(), { wrapper });
  return {
    page: () => hook.result.current,
    /** Runs a change and redraws from the URL it left, as Next does. */
    change: (fn: () => void) => {
      act(fn);
      hook.rerender();
    },
    client,
    rerender: hook.rerender,
  };
}

// Three PC games (one finished, one hidden), two on Switch 2, one on PS5.
const library = () => [
  steam({ name: 'Hades' }),
  steam({ name: 'Celeste', status: 'finished' }),
  steam({ name: 'Old Tool', status: 'hidden' }),
  game({ name: 'Mario Kart World' }),
  game({ name: 'Metroid Prime 4', status: 'finished' }),
  game({ name: 'Astro Bot', platform: 'PS5' }),
];

beforeEach(() => {
  nextId = 1;
});

it('offers no platform filter to a library all on one platform', () => {
  const { page } = open([steam(), steam(), steam()], '?platform=PC');
  expect(page().platforms).toBeNull();
  expect(page().visibleGames).toHaveLength(3);
});

it('lists the platforms with the most games first, each with what it would show', () => {
  const { page } = open(library());
  expect(page().platforms).toMatchObject({
    value: '',
    // Hidden games aren't in All, so PC lists two of its three.
    options: [
      { value: 'PC', count: 2 },
      { value: 'Switch 2', count: 2 },
      { value: 'PS5', count: 1 },
    ],
    allCount: 5,
  });
  expect(page().visibleGames).toHaveLength(5);
});

it('lists one platform, and counts the status filters within it', () => {
  const { page } = open(library(), '?platform=Switch+2');
  expect(page().platforms?.value).toBe('Switch 2');
  expect(
    page()
      .visibleGames.map((g) => g.name)
      .sort(),
  ).toEqual(['Mario Kart World', 'Metroid Prime 4']);
  expect(page().counts).toMatchObject({ all: 2, backlog: 1, finished: 1, hidden: 0 });
  // The menu still says what every platform would show.
  expect(page().platforms?.allCount).toBe(5);
});

it('keeps the choice in the address, and takes it out again for all platforms', () => {
  const { page, change } = open(library(), '?filter=finished');

  change(() => page().platforms!.set('PC'));
  expect(window.location.search).toBe('?filter=finished&platform=PC');
  expect(page().visibleGames.map((g) => g.name)).toEqual(['Celeste']);

  change(() => page().platforms!.set(''));
  expect(window.location.search).toBe('?filter=finished');
  expect(page().visibleGames).toHaveLength(2);
});

it("offers the platforms with games under the status filter and the search that's on", () => {
  // PS5 has nothing finished: it isn't offered there.
  const finished = open(library(), '?filter=finished');
  expect(finished.page().platforms).toMatchObject({
    options: [
      { value: 'PC', count: 1 },
      { value: 'Switch 2', count: 1 },
    ],
    allCount: 2,
  });

  const searched = open(library(), '?q=metroid');
  expect(searched.page().platforms).toMatchObject({
    options: [{ value: 'Switch 2', count: 1 }],
    allCount: 1,
  });
});

it('keeps the chosen platform in the menu when it has nothing to list', () => {
  const { page, change } = open(library(), '?platform=PS5');
  expect(page().platforms?.options.map((o) => o.value)).toEqual(['PC', 'Switch 2', 'PS5']);

  // Finished: PS5 has none, but it's what the menu is set to.
  change(() => page().setFilter('finished'));
  expect(page().platforms).toMatchObject({
    value: 'PS5',
    options: [
      { value: 'PC', count: 1 },
      { value: 'Switch 2', count: 1 },
      { value: 'PS5', count: 0 },
    ],
  });
  expect(page().visibleGames).toEqual([]);

  change(() => page().platforms!.set('PC'));
  expect(page().platforms?.options.map((o) => o.value)).toEqual(['PC', 'Switch 2']);
  change(() => page().setFilter('all'));
  expect(page().platforms?.options.map((o) => o.value)).toEqual(['PC', 'Switch 2', 'PS5']);
});

it('offers no filter under a status whose games are all on one platform, or on none', () => {
  // The only hidden game is on PC.
  expect(open(library(), '?filter=hidden').page().platforms).toBeNull();
  // Nothing dropped anywhere.
  expect(open(library(), '?filter=dropped').page().platforms).toBeNull();
  // Two platforms have finished games.
  expect(open(library(), '?filter=finished').page().platforms).not.toBeNull();
});

it('comes and goes with the status filter, but stays while a platform is chosen', () => {
  const { page, change } = open(library());
  expect(page().platforms).not.toBeNull();
  change(() => page().setFilter('hidden'));
  expect(page().platforms).toBeNull();
  change(() => page().setFilter('all'));

  change(() => page().platforms!.set('PC'));
  change(() => page().setFilter('hidden'));
  expect(page().platforms).toMatchObject({
    value: 'PC',
    options: [{ value: 'PC', count: 1 }],
    allCount: 1,
  });
  change(() => page().platforms!.set(''));
  expect(page().platforms).toBeNull();
});

it("doesn't hide the filter because a search narrowed the page to one platform", () => {
  const { page } = open(library(), '?q=metroid');
  expect(page().platforms).toMatchObject({
    options: [{ value: 'Switch 2', count: 1 }],
    allCount: 1,
  });
});

it('shows everything for a platform the library has no games on', () => {
  const { page } = open(library(), '?platform=Dreamcast');
  expect(page().platforms?.value).toBe('');
  expect(page().visibleGames).toHaveLength(5);
});

it('goes back to everything when the last game on the chosen platform is gone', () => {
  const games = library();
  const { page, client, rerender } = open(games, '?platform=PS5');
  expect(page().visibleGames.map((g) => g.name)).toEqual(['Astro Bot']);

  act(() =>
    client.setQueryData(
      queryKeys.games.list('user-1'),
      games.filter((g) => g.platform !== 'PS5'),
    ),
  );
  rerender();
  expect(page().platforms?.value).toBe('');
  expect(page().platforms?.options.map((o) => o.value)).toEqual(['PC', 'Switch 2']);
  expect(page().visibleGames).toHaveLength(4);
});

it('counts a Steam game as PC, with or without the platform saved, and one moved to a console there', () => {
  const { page } = open([
    steam({ platform: null }),
    steam(),
    steam({ platform: 'Switch' }),
    game({ platform: 'PC', name: 'From another store' }),
  ]);
  expect(page().platforms?.options).toEqual([
    { value: 'PC', count: 3 },
    { value: 'Switch', count: 1 },
  ]);
});

it('starts the list over when the platform changes', () => {
  const many = Array.from({ length: 130 }, () => steam());
  const { page, change } = open([...many, game()]);

  change(() => page().loadMore());
  expect(page().visibleGames).toHaveLength(120);

  change(() => page().platforms!.set('PC'));
  expect(page().visibleGames).toHaveLength(60);
  expect(page().hasMore).toBe(true);
});

it('ticks only the listed platform with Select all', () => {
  const { page, change } = open(library(), '?platform=Switch+2');
  change(() => page().toggleSelecting());
  expect(page().selection?.total).toBe(2);
  change(() => page().selection!.selectAll());
  expect(page().selection?.count).toBe(2);
});
