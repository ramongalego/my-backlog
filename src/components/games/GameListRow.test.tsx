import { render, screen } from '@testing-library/react';
import { GameListRow } from '@/components/games/GameListRow';
import type { GameItem } from '@/lib/data/loaders';
import type { LibraryPlatforms } from '@/lib/games/consoles';

// Not known yet unless a test sets it.
let mockLibrary: LibraryPlatforms | null = null;
jest.mock('@/hooks/useLibraryMeta', () => ({
  ...jest.requireActual('@/hooks/useLibraryMeta'),
  useLibraryPlatforms: () => mockLibrary,
}));
beforeEach(() => {
  mockLibrary = null;
});

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const game = (overrides: Partial<GameItem>): GameItem => ({
  id: 1,
  source: 'steam',
  platform: 'PC',
  app_id: 1,
  name: 'Hades',
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
  release_date: 'Sep 17, 2020',
  last_played_at: null,
  deck_compat: 3,
  ...overrides,
});

const steamGame = () => game({});
const ps5Game = () =>
  game({ id: 2, name: 'Astro Bot', source: 'manual', platform: 'PS5', app_id: null });

const row = (item: GameItem) =>
  render(
    <ul>
      <GameListRow game={item} onOpenDetail={jest.fn()} />
    </ul>,
  );

describe("the platform in a row's details, by what the library is on", () => {
  it.each([
    ['PC', { main: 'PC', count: 2 }],
    ['PS5', { main: 'PS5', count: 2 }],
  ])(
    "says every game's platform, PC too, in a library mostly on %s",
    (_, library: LibraryPlatforms) => {
      mockLibrary = library;
      const { unmount } = row(steamGame());
      expect(screen.getByText('PC')).toBeVisible();
      // Still a Steam game: its Deck rating stays.
      expect(screen.getByText('Deck')).toBeInTheDocument();
      unmount();

      row(ps5Game());
      expect(screen.getByText('PS5')).toBeVisible();
      expect(screen.queryByText('Deck')).not.toBeInTheDocument();
    },
  );

  it("says it in the details only: there's no tag on the thumbnail to name", () => {
    mockLibrary = { main: 'PS5', count: 2 };
    row(steamGame());
    expect(screen.queryByText(/^On /)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open details for Hades' })).toBeInTheDocument();
  });

  it('says nothing with the page filtered to one platform', () => {
    mockLibrary = { main: 'PC', count: 2 };
    render(
      <ul>
        <GameListRow game={ps5Game()} onOpenDetail={jest.fn()} showPlatform={false} />
      </ul>,
    );
    expect(screen.queryByText(/PS5/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open details for Astro Bot' })).toBeInTheDocument();
    // Still a console game: no Deck rating.
    expect(screen.queryByText('Deck')).not.toBeInTheDocument();
  });

  it('says nothing in a library all on one platform', () => {
    mockLibrary = { main: 'PS5', count: 1 };
    row(ps5Game());
    expect(screen.queryByText(/PS5/)).not.toBeInTheDocument();
  });

  it('says only a console until the library is known, as before', () => {
    const { unmount } = row(steamGame());
    expect(screen.queryByText(/PC/)).not.toBeInTheDocument();
    unmount();

    row(ps5Game());
    expect(screen.getByText('PS5')).toBeVisible();
  });
});
