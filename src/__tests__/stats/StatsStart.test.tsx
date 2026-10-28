import { fireEvent, render, screen } from '@testing-library/react';
import { StatsStart } from '@/components/stats/StatsStart';
import { computeStats, isStarting } from '@/hooks/useStats';
import type { GameItem } from '@/lib/data/loaders';

const game = (overrides: Partial<GameItem> = {}): GameItem =>
  ({
    id: Math.random(),
    name: 'Game',
    status: 'backlog',
    playtime_forever: 0,
    main_story_hours: null,
    tags: null,
    rating: null,
    finished_at: null,
    header_image: null,
    release_date: null,
    ...overrides,
  }) as GameItem;

const stats = (games: GameItem[]) => computeStats(games, {}, new Set())!;

describe('isStarting', () => {
  it('is true for a library with nothing finished, dropped or played', () => {
    expect(isStarting(stats([game(), game()]))).toBe(true);
  });

  it.each([
    ['a finished game', { status: 'finished' }],
    ['a dropped game', { status: 'dropped' }],
    ['an hour played', { playtime_forever: 60 }],
  ])('is false once there is %s', (_, overrides) => {
    expect(isStarting(stats([game(), game(overrides as Partial<GameItem>)]))).toBe(false);
  });
});

describe('StatsStart', () => {
  const props = { backlog: 4, storyHours: 62, onAddGame: jest.fn(), onConnectSteam: jest.fn() };

  it('says what you have so far and offers both ways to add more', () => {
    render(<StatsStart {...props} isSteamConnected={false} />);
    expect(screen.getByText(/You have/)).toHaveTextContent(
      'You have 4 games in your backlog, about 62 hours of story. Your stats fill in as you play.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect Steam' }));
    expect(props.onAddGame).toHaveBeenCalled();
    expect(props.onConnectSteam).toHaveBeenCalled();
  });

  it("doesn't offer Steam once it's connected", () => {
    render(<StatsStart {...props} isSteamConnected />);
    expect(screen.queryByRole('button', { name: 'Connect Steam' })).not.toBeInTheDocument();
    expect(screen.queryByText(/from Steam/)).not.toBeInTheDocument();
  });

  it('leaves out the hours of story when there are none', () => {
    render(<StatsStart {...props} storyHours={0} isSteamConnected={false} />);
    expect(screen.getByText(/You have/)).toHaveTextContent(
      'You have 4 games in your backlog. Your stats fill in as you play.',
    );
  });
});
