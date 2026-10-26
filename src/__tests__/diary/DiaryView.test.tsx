import { fireEvent, render, screen } from '@testing-library/react';
import DiaryView from '@/app/(app)/diary/View';
import type { DiaryEntry } from '@/lib/data/loaders';

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({ alt }: { alt: string }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} />;
  },
}));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

// The modal's props are what matter here, not its internals.
const mockModal = jest.fn();
jest.mock('@/components/games/GameStatusModal', () => ({
  GameDetailModal: (props: Record<string, unknown>) => {
    mockModal(props);
    return <div role="dialog">{String(props.gameName)}</div>;
  },
}));

const entry: DiaryEntry = {
  id: 1,
  app_id: 1,
  name: 'Celeste',
  header_image: null,
  rating: 9,
  notes: null,
  finished_at: '2026-10-20T10:00:00Z',
  playtime_forever: 9 * 60,
  main_story_hours: 8.3,
  steam_review_score: 97,
  steam_review_count: 140237,
  deck_compat: 3,
  last_played_at: '2026-10-20T09:00:00Z',
};

let mockDetail: { game: DiaryEntry } | null = null;
const mockOpen = jest.fn();
jest.mock('@/hooks/useDiary', () => ({
  useDiary: () => ({
    entries: [entry],
    loading: false,
    hasPlayingGame: false,
    detailModal: mockDetail && {
      appId: 1,
      gameName: 'Celeste',
      headerImage: null,
      game: mockDetail.game,
      initialStatus: 'finished',
      initialDate: '2026-10-20',
      initialNotes: null,
      initialRating: 9,
    },
    handleOpenDetail: mockOpen,
    handleCloseDetail: jest.fn(),
    handleConfirmDetail: jest.fn(),
    handleSaveNotes: jest.fn(),
  }),
}));

beforeEach(() => {
  mockDetail = null;
  mockOpen.mockClear();
  mockModal.mockClear();
});

it('opens the entry from its art, like every other card', () => {
  render(<DiaryView />);

  fireEvent.click(screen.getByRole('button', { name: 'Edit Celeste' }));
  expect(mockOpen).toHaveBeenCalledWith(1);
  // The art is the only edit control now.
  expect(screen.getAllByRole('button', { name: /^Edit/ })).toHaveLength(1);
});

it('shows the hours it took beside the rating, and leaves the other details to the modal', () => {
  render(<DiaryView />);

  // Rendered for desktop and phones (CSS shows one).
  expect(screen.getAllByText('9h')).toHaveLength(2);
  expect(screen.queryByText('8.3h')).not.toBeInTheDocument();
  expect(screen.queryByText('97%')).not.toBeInTheDocument();
});

it('gives the modal the game details too', () => {
  mockDetail = { game: entry };
  render(<DiaryView />);

  expect(mockModal).toHaveBeenCalledWith(
    expect.objectContaining({
      mainStoryHours: 8.3,
      steamReviewScore: 97,
      steamReviewCount: 140237,
      playtimeMinutes: 540,
      lastPlayedAt: entry.last_played_at,
      deckCompat: 3,
    }),
  );
});
