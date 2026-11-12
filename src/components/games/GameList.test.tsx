import { fireEvent, render, screen, within } from '@testing-library/react';
import { GameList } from '@/components/games/GameList';
import type { GameItem } from '@/lib/data/loaders';
import { ratingOf } from '@/lib/games/rating';

const shown = (game: GameItem) => String(Math.round(ratingOf(game)!));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} />;
  },
}));

const game = (overrides: Partial<GameItem>): GameItem => ({
  id: 1,
  source: 'steam',
  platform: null,
  app_id: 1,
  name: 'Hades',
  playtime_forever: 0,
  steam_review_score: 97,
  steam_review_count: 1000,
  critic_score: null,
  critic_count: null,
  steam_review_weighted: 95,
  header_image: null,
  main_story_hours: 23.4,
  status: 'backlog',
  notes: null,
  rating: null,
  finished_at: null,
  dropped_at: null,
  tags: null,
  created_at: '2026-01-01T00:00:00Z',
  release_date: 'Sep 17, 2020',
  last_played_at: null,
  ...overrides,
});

const GAMES = [
  game({ id: 1, name: 'Hades', playtime_forever: 132 }),
  game({
    id: 2,
    name: 'Persona 5 Royal',
    status: 'finished',
    rating: 9,
    critic_score: 95,
    critic_count: 40,
    playtime_forever: 5700,
    main_story_hours: 101.3,
    source: 'manual',
    platform: 'PS5',
  }),
  game({ id: 3, name: 'Metroid Ravenous', main_story_hours: null, release_date: 'Jan 28, 2099' }),
];

function setup(props: Partial<Parameters<typeof GameList>[0]> = {}) {
  const onOpenDetail = jest.fn();
  const onSortChange = jest.fn();
  render(
    <GameList
      games={GAMES}
      queuedGameIds={new Set([3])}
      showStatus
      sort="score"
      reversed={false}
      onSortChange={onSortChange}
      onOpenDetail={onOpenDetail}
      {...props}
    />,
  );
  const row = (name: string) => screen.getByText(name, { selector: 'button' }).closest('li')!;
  return { onOpenDetail, onSortChange, row };
}

// The figures in a row's columns (from lg), each read out with what it is,
// without the tooltip that explains it.
const columns = (row: HTMLElement) =>
  [...row.querySelectorAll(':scope > span.text-center')].map((cell) => {
    const figure = cell.cloneNode(true) as HTMLElement;
    figure.querySelectorAll('[role="tooltip"]').forEach((tip) => tip.remove());
    return figure.textContent;
  });
// The tooltip on a row's figure, as screen readers get it.
const tooltip = (row: HTMLElement, column: number) =>
  row.querySelectorAll(':scope > span.text-center')[column].querySelector('[role="tooltip"]')
    ?.textContent;

it('explains each figure in a tooltip, as the cards do', () => {
  const { row } = setup();
  expect(tooltip(row('Hades'), 0)).toBe('Time to beat: Main StoryFrom HowLongToBeat');
  expect(tooltip(row('Persona 5 Royal'), 1)).toContain(
    "Critic score: 95The average of 40 critics' reviews",
  );
  expect(tooltip(row('Hades'), 2)).toBe('2.2h played');
});

it('opens the game from a figure too, once', () => {
  const { onOpenDetail, row } = setup();
  fireEvent.click(row('Hades').querySelector(':scope > span.text-center span')!);
  expect(onOpenDetail).toHaveBeenCalledTimes(1);
  expect(onOpenDetail).toHaveBeenCalledWith(1);
});

it('lists each game with its figures in columns, read out with what they are', () => {
  const { row } = setup();

  expect(columns(row('Persona 5 Royal'))).toEqual([
    '101.3h to beat the main story',
    // The rating the Rating sort ranks by, so the column reads in order.
    `${shown(GAMES[1])} rating`,
    '95h played',
  ]);
  // With only Steam's score, the rating comes from that.
  expect(columns(row('Hades'))).toEqual([
    '23.4h to beat the main story',
    `${shown(GAMES[0])} rating`,
    '2.2h played',
  ]);
  // A console game says which console.
  expect(within(row('Persona 5 Royal')).getByText('PS5')).toBeInTheDocument();
});

it("leaves a figure out when the game doesn't have it", () => {
  const { row } = setup();
  // No time to beat, and under an hour played isn't shown, as on the cards.
  expect(columns(row('Metroid Ravenous'))).toEqual(['', `${shown(GAMES[2])} rating`, '']);
});

it('names each row the way its card is named, badges and release included', () => {
  setup();
  expect(
    screen.getByRole('button', { name: 'Open details for Persona 5 Royal, Finished 9/10' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', {
      name: 'Open details for Metroid Ravenous, Queued, Out Jan 28, 2099',
    }),
  ).toBeInTheDocument();
});

it('opens the game from its row', () => {
  const { onOpenDetail } = setup();
  fireEvent.click(screen.getByRole('button', { name: /Open details for Hades/ }));
  expect(onOpenDetail).toHaveBeenCalledWith(1);
});

it('has a status column only where the statuses differ', () => {
  setup({ showStatus: false });
  expect(screen.queryByText('Status')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Open details for Persona 5 Royal, 9/10' }),
  ).toBeInTheDocument();
});

describe('the column header', () => {
  it('sorts by a column, with the same sorts as the Sort menu', () => {
    const { onSortChange } = setup();
    const header = screen.getByRole('group', { name: 'Sort by' });

    fireEvent.click(within(header).getByRole('button', { name: 'Time to beat' }));
    fireEvent.click(within(header).getByRole('button', { name: 'Played' }));
    fireEvent.click(within(header).getByRole('button', { name: 'My rating' }));

    expect(onSortChange.mock.calls).toEqual([['length'], ['playtime'], ['rating']]);
  });

  it('marks the column the list is sorted by, and which way it runs', () => {
    setup({ sort: 'length', reversed: true });
    const header = screen.getByRole('group', { name: 'Sort by' });
    expect(
      within(header).getByRole('button', { name: /^Time to beat ?, Longest first$/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(header).getByRole('button', { name: 'Played' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
