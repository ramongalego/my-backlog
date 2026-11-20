import { fireEvent, render, screen, within } from '@testing-library/react';
import { focusActivityRow, RecentActivity } from '@/components/profile/RecentActivity';
import {
  activityDay,
  type ActivityEntry,
  type ActivityKind,
  type ActivityLine,
} from '@/lib/account/activity';
import type { LibraryPlatforms } from '@/lib/games/consoles';
import { toLocalIsoDate } from '@/lib/diary/date-utils';

// What the library is played on: unknown unless a test sets it.
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

/**
 * An entry about one thing (`kind`), or several (`lines`). A rating goes on both the
 * line and the entry, as the rules give it; with `lines`, each line says its own.
 */
const entry = (
  overrides: Partial<ActivityEntry> & { kind?: ActivityKind } & Omit<ActivityLine, 'kind'> = {},
): ActivityEntry => {
  const { kind = 'finished', minutes, to, rating, ...rest } = overrides;
  const made = {
    id: 1,
    name: 'Test Game',
    header_image: null,
    source: 'steam',
    platform: 'PC',
    lines: [{ kind, minutes, to, ...(rating != null ? { rating } : {}) }],
    day: '2026-10-19',
    at: '',
    rating: rating ?? null,
    ...rest,
  };
  // What the game's own row says, unless the test names an event.
  return { key: `game-${made.id}`, ...made };
};

const onOpen = jest.fn();
beforeEach(() => onOpen.mockClear());

const section = () => within(screen.getByRole('region', { name: 'Recent activity' }));
const rows = () => section().getAllByRole('listitem');
/** When each row says it happened, at its far end; null for a row that says nothing. */
const whens = () => rows().map((row) => row.querySelector('time')?.textContent ?? null);
/** One line of a row, found by what it says happened: its label and what follows it. */
const lineOf = (row: HTMLElement, label: string) => within(row).getByText(label).parentElement!;

it('says what happened to each game, and where it was played', () => {
  render(
    <RecentActivity
      onOpen={onOpen}
      entries={[
        entry({
          id: 1,
          kind: 'playing',
          name: 'Ocarina of Time',
          source: 'manual',
          platform: 'Switch 2',
          day: '2026-11-13',
        }),
        entry({
          id: 2,
          name: "Fire Emblem: Fortune's Weave",
          source: 'manual',
          platform: 'Switch 2',
          rating: 9,
        }),
        entry({ id: 3, kind: 'dropped', name: 'Super Meat Boy', day: '2026-04-11' }),
      ]}
    />,
  );
  const [playing, finished, dropped] = rows();
  expect(playing).toHaveTextContent(/^Ocarina of Time Switch 2 Started playing$/);
  expect(finished).toHaveTextContent(
    /^Fire Emblem: Fortune's Weave Switch 2 Finished Rated 9\/10$/,
  );
  // A Steam game played on Steam names no platform, as on its card.
  expect(dropped).toHaveTextContent(/^Super Meat Boy Dropped$/);
});

it('colors each by its status, as everywhere else', () => {
  render(
    <RecentActivity
      onOpen={onOpen}
      entries={[
        entry({ id: 1, kind: 'playing' }),
        entry({ id: 2, kind: 'finished' }),
        entry({ id: 3, kind: 'dropped' }),
      ]}
    />,
  );
  expect(screen.getByText('Started playing')).toHaveClass('text-accent-400');
  expect(screen.getByText('Finished')).toHaveClass('text-emerald-400');
  expect(screen.getByText('Dropped')).toHaveClass('text-rose-400');
});

it('keeps orange for the game being played: a start of one that is not is neutral', () => {
  render(
    <RecentActivity
      onOpen={onOpen}
      entries={[entry({ id: 1, kind: 'playing' }), entry({ id: 2, kind: 'started' })]}
    />,
  );
  const [playing, started] = rows();
  expect(within(playing).getByText('Started playing')).toHaveClass('text-accent-400');
  expect(within(started).getByText('Started playing')).toHaveClass('text-ink-300');
  expect(within(started).getByText('Started playing')).not.toHaveClass('text-accent-400');
});

it('says the game being played started, in the past tense like every line', () => {
  render(
    <RecentActivity
      onOpen={onOpen}
      entries={[
        entry({ id: 1, kind: 'playing', name: 'Hades' }),
        entry({ id: 2, kind: 'started', name: 'Celeste' }),
      ]}
    />,
  );
  const [playing, started] = rows();
  expect(playing).toHaveTextContent(/^Hades Started playing$/);
  expect(started).toHaveTextContent(/^Celeste Started playing$/);
  expect(screen.queryByText('Playing now')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hades Started playing' })).toBeInTheDocument();
});

it('shows a game being played without a day when its start is not known', () => {
  render(<RecentActivity onOpen={onOpen} entries={[entry({ kind: 'playing', day: null })]} />);
  expect(rows()[0]).toHaveTextContent(/^Test Game Started playing$/);
});

it('leads on to the Diary', () => {
  render(<RecentActivity onOpen={onOpen} entries={[entry({})]} />);
  expect(screen.getByRole('link', { name: 'Diary' })).toHaveAttribute('href', '/diary');
});

it('says what will show up when there is nothing yet', () => {
  render(<RecentActivity onOpen={onOpen} entries={[]} />);
  expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Diary' })).not.toBeInTheDocument();
});

it('opens the game from its row, to fix a date or a rating where it is seen', () => {
  render(
    <RecentActivity
      onOpen={onOpen}
      entries={[entry({ id: 7, name: 'Hades', rating: 9 }), entry({ id: 8, name: 'Celeste' })]}
    />,
  );
  const hades = screen.getByRole('button', { name: /^Hades Finished Rated 9\/10$/ });
  fireEvent.click(hades);
  expect(onOpen).toHaveBeenCalledWith(7);
  fireEvent.click(screen.getByRole('button', { name: /^Celeste/ }));
  expect(onOpen).toHaveBeenLastCalledWith(8);
});

it('keeps a row, and the focus on it, when more happens to its game', () => {
  const queued = entry({ key: 'event-1', id: 7, kind: 'queued', name: 'Hades' });
  const { rerender } = render(<RecentActivity onOpen={onOpen} entries={[queued]} />);
  const row = screen.getByRole('button', { name: /^Hades Added to queue/ });
  row.focus();

  rerender(
    <RecentActivity
      onOpen={onOpen}
      entries={[entry({ key: 'event-2', id: 7, kind: 'finished', name: 'Hades' }), queued]}
    />,
  );
  expect(screen.getByRole('button', { name: /^Hades Added to queue/ })).toBe(row);
  expect(row).toHaveFocus();
});

describe('what the history adds', () => {
  it.each([
    [{ kind: 'started' }, 'Started playing'],
    [{ kind: 'added' }, 'Added to backlog'],
    [{ kind: 'queued' }, 'Added to queue'],
    [{ kind: 'paused' }, 'Paused, moved to queue'],
    [{ kind: 'unqueued' }, 'Taken off the queue'],
    [{ kind: 'backlog' }, 'Moved to backlog'],
    [{ kind: 'wont_play' }, "Marked Won't Play"],
    [{ kind: 'favorite' }, 'Added to favorites'],
    [{ kind: 'unfavorite' }, 'Removed from favorites'],
    [{ kind: 'note' }, 'Wrote a note'],
    [{ kind: 'played', minutes: 150 }, 'Played 2h 30m'],
    [{ kind: 'moved', to: 'Switch 2' }, 'Moved to Switch 2'],
  ] as const)('says %o as "%s"', (what, said) => {
    render(<RecentActivity onOpen={onOpen} entries={[entry({ ...what, day: '2026-11-17' })]} />);
    expect(rows()[0]).toHaveTextContent(new RegExp(`^Test Game ${said}$`));
  });

  it('shows the rating a game was given', () => {
    render(<RecentActivity onOpen={onOpen} entries={[entry({ kind: 'rated', rating: 8 })]} />);
    expect(rows()[0]).toHaveTextContent(/^Test Game Rated 8\/10$/);
  });

  it('says a rating given by itself as its own text, with no second rating after it', () => {
    render(<RecentActivity onOpen={onOpen} entries={[entry({ kind: 'rated', rating: 8 })]} />);
    const [row] = rows();
    expect(within(row).getByText('Rated 8/10')).toHaveClass('text-ink-300');
    expect(within(row).getAllByText(/8\/10/)).toHaveLength(1);
    expect(lineOf(row, 'Rated 8/10')).toHaveTextContent(/^Rated 8\/10$/);
  });

  it('says a game paused for another apart from one put on the queue', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          entry({ key: 'event-2', id: 7, name: 'Hades', kind: 'paused' }),
          entry({ key: 'event-1', id: 8, name: 'Celeste', kind: 'queued' }),
        ]}
      />,
    );
    const [paused, queued] = rows();
    expect(paused).toHaveTextContent(/^Hades Paused, moved to queue$/);
    expect(queued).toHaveTextContent(/^Celeste Added to queue$/);
    expect(within(paused).getByText('Paused, moved to queue')).toHaveClass('text-ink-300');
    expect(within(queued).getByText('Added to queue')).toHaveClass('text-ink-300');
  });

  it("doesn't say the console twice for a game moved to it", () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[entry({ kind: 'moved', to: 'Switch 2', source: 'manual', platform: 'Switch 2' })]}
      />,
    );
    expect(rows()[0]).toHaveTextContent(/Moved to Switch 2/);
    expect(rows()[0]).not.toHaveTextContent('(Switch 2)');
  });

  it('opens the game from any of its rows, each row its own', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          entry({ key: 'event-2', id: 7, name: 'Hades', kind: 'queued' }),
          entry({ key: 'event-1', id: 7, name: 'Hades', kind: 'added' }),
        ]}
      />,
    );
    expect(rows()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /^Hades Added to backlog/ }));
    expect(onOpen).toHaveBeenCalledWith(7);
  });
});

describe('several things done to one game in a row', () => {
  const update = (key: string, overrides: Parameters<typeof entry>[0]) =>
    entry({
      key,
      id: 7,
      name: 'Portal',
      source: 'manual',
      platform: 'Switch',
      day: '2026-11-17',
      ...overrides,
    });
  const updates = [
    update('event-3', { kind: 'finished', rating: 10 }),
    update('event-2', { kind: 'played', minutes: 90 }),
    update('event-1', { kind: 'queued' }),
  ];
  const portal = update('updates-event-1', {
    lines: updates.map((one) => one.lines[0]).reverse(),
    rating: 10,
    updates,
  });
  const toggle = () => screen.getByRole('button', { name: 'Portal 3 updates' });

  it('is one row: the game and how many updates, folded away', () => {
    render(<RecentActivity onOpen={onOpen} entries={[portal]} />);
    expect(rows()).toHaveLength(1);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle().querySelector('[data-chip="3"]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: /^Portal Finished/ })).not.toBeInTheDocument();
  });

  it('opens to each update, newest first, each its own row that opens the game', () => {
    render(<RecentActivity onOpen={onOpen} entries={[portal]} />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(onOpen).not.toHaveBeenCalled();
    const list = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent!.replace(/\s+/g, ' ').trim()),
    ).toEqual([
      'Portal Switch Finished and rated it 10/10',
      'Portal Switch Played 1h 30m',
      'Portal Switch Added to queue',
    ]);

    fireEvent.click(within(list).getByRole('button', { name: /^Portal Switch Played/ }));
    expect(onOpen).toHaveBeenCalledWith(7);

    fireEvent.click(toggle());
    expect(screen.queryByRole('button', { name: /^Portal Switch Played/ })).not.toBeInTheDocument();
  });

  it('counts as one of the six rows', () => {
    const others = Array.from({ length: 5 }, (_, i) =>
      entry({ key: `event-${i + 10}`, id: i + 20, name: `Game ${i}` }),
    );
    render(<RecentActivity onOpen={onOpen} entries={[portal, ...others]} />);
    expect(rows()).toHaveLength(6);
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });
});

describe('one thing done to a game', () => {
  it('says it as one sentence, what and the rating it came with, with the console beside the name', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          entry({
            source: 'manual',
            platform: 'Switch',
            lines: [{ kind: 'dropped', rating: 4 }],
            rating: 4,
          }),
        ]}
      />,
    );
    expect(lineOf(rows()[0], 'Dropped')).toHaveTextContent(/^Dropped and rated it 4\/10$/);
    expect(rows()[0]).toHaveTextContent(/ Switch .*Dropped and rated it 4\/10$/);
    // Once, in the sentence: not again at the row's far end.
    expect(rows()[0].textContent!.match(/4\/10/g)).toHaveLength(1);
  });

  it('draws no rating for a line that came without one', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[entry({ kind: 'finished' }), entry({ id: 2, kind: 'dropped' })]}
      />,
    );
    expect(section().queryByText(/\/10/)).not.toBeInTheDocument();
  });
});

describe('a long list', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      entry({ key: `event-${i}`, id: i + 1, name: `Game ${i + 1}`, kind: 'added' }),
    );
  const showMore = () => screen.queryByRole('button', { name: 'Show more' });
  const showFewer = () => screen.queryByRole('button', { name: 'Show fewer' });
  const heading = () => screen.getByRole('heading', { level: 2, name: 'Recent activity' });

  it('shows six rows, and no Show more when that is all of them', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(6)} />);
    expect(rows()).toHaveLength(6);
    expect(showMore()).not.toBeInTheDocument();
    expect(showFewer()).not.toBeInTheDocument();
  });

  it('shows six more each time Show more is pressed, until there are none left', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    expect(rows()).toHaveLength(6);

    fireEvent.click(showMore()!);
    expect(rows()).toHaveLength(12);

    fireEvent.click(showMore()!);
    expect(rows()).toHaveLength(14);
    expect(showMore()).not.toBeInTheDocument();
  });

  it('moves the focus to the first row it added, so the list is carried on from there', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    fireEvent.click(showMore()!);
    expect(screen.getByRole('button', { name: /^Game 7 / })).toHaveFocus();

    // The last press takes the button away: the focus is on a row, not lost.
    fireEvent.click(showMore()!);
    expect(screen.getByRole('button', { name: /^Game 13 / })).toHaveFocus();
  });

  it('says "Show more" however many are left, and adds what there is', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(8)} />);
    expect(showMore()).toHaveAccessibleName('Show more');
    expect(screen.queryByRole('button', { name: /^Show \d/ })).not.toBeInTheDocument();

    fireEvent.click(showMore()!);
    expect(rows()).toHaveLength(8);
    expect(showMore()).not.toBeInTheDocument();
  });

  it('is a text button with a chevron, not an underlined link', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    fireEvent.click(showMore()!);
    for (const button of [showMore()!, showFewer()!]) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button.className).not.toMatch(/underline/);
      expect(button.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    }
    expect(section().getAllByRole('link')).toHaveLength(1);
  });

  it('offers Show fewer once more than six rows show, beside Show more', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    expect(showFewer()).not.toBeInTheDocument();

    fireEvent.click(showMore()!);
    expect(showFewer()).toBeInTheDocument();
    expect(showMore()!.nextElementSibling).toBe(showFewer());
  });

  it('keeps Show fewer when nothing more is left to show', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(8)} />);
    fireEvent.click(showMore()!);
    expect(rows()).toHaveLength(8);
    expect(showMore()).not.toBeInTheDocument();
    expect(showFewer()).toBeInTheDocument();
  });

  it('goes back to six rows when Show fewer is pressed, however many were showing', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    fireEvent.click(showMore()!);
    fireEvent.click(showMore()!);
    expect(rows()).toHaveLength(14);

    fireEvent.click(showFewer()!);
    expect(rows()).toHaveLength(6);
    expect(screen.getByRole('button', { name: /^Game 6 / })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Game 7 / })).not.toBeInTheDocument();
    expect(showMore()).toBeInTheDocument();
    expect(showFewer()).not.toBeInTheDocument();
  });

  it("moves the focus to the section's heading when Show fewer is pressed", () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    fireEvent.click(showMore()!);
    // On a row that Show fewer takes away.
    expect(screen.getByRole('button', { name: /^Game 7 / })).toHaveFocus();

    fireEvent.click(showFewer()!);
    expect(document.getElementById('profile-activity')).toBe(heading());
    expect(heading()).toHaveAttribute('tabindex', '-1');
    expect(heading()).toHaveFocus();
  });

  it('shows more again after Show fewer, the focus on the first row added', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    fireEvent.click(showMore()!);
    fireEvent.click(showFewer()!);
    fireEvent.click(showMore()!);
    expect(rows()).toHaveLength(12);
    expect(screen.getByRole('button', { name: /^Game 7 / })).toHaveFocus();
  });

  it("doesn't take the focus when the list changes by itself", () => {
    const { rerender } = render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    fireEvent.click(showMore()!);
    screen.getByRole('link', { name: 'Diary' }).focus();

    rerender(<RecentActivity onOpen={onOpen} entries={many(15)} />);
    expect(screen.getByRole('link', { name: 'Diary' })).toHaveFocus();
  });
});

describe('a bulk move', () => {
  const games = ['The Vagrant', 'Wizard of Legend', 'Hacknet'].map((name, i) =>
    entry({ key: `event-${10 + i}`, id: 10 + i, name, kind: 'wont_play', day: '2026-11-17' }),
  );
  const bulk = entry({
    key: 'bulk-event-12',
    id: 10,
    name: '3 games',
    kind: 'wont_play',
    day: '2026-11-17',
    games,
  });
  const toggle = () => screen.getByRole('button', { name: "3 games Marked Won't Play" });

  it('is one row: how many games and what was done to them, the games folded away', () => {
    render(<RecentActivity onOpen={onOpen} entries={[bulk]} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^The Vagrant/ })).not.toBeInTheDocument();
    expect(toggle().querySelector('[data-chip="3"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('opens to the games, each its own row that opens its dialog, and folds them away again', () => {
    render(<RecentActivity onOpen={onOpen} entries={[bulk]} />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: "Hacknet Marked Won't Play" }));
    expect(onOpen).toHaveBeenCalledWith(12);

    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^Hacknet/ })).not.toBeInTheDocument();
  });

  it('counts as one of the six rows', () => {
    const others = Array.from({ length: 5 }, (_, i) =>
      entry({ key: `event-${i}`, id: i + 1, name: `Game ${i + 1}`, kind: 'added' }),
    );
    render(<RecentActivity onOpen={onOpen} entries={[bulk, ...others]} />);
    fireEvent.click(toggle());
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Game 5 / })).toBeInTheDocument();
  });

  it('takes the focus when it is the first row Show more adds', () => {
    const before = Array.from({ length: 6 }, (_, i) =>
      entry({ key: `event-${i}`, id: i + 1, name: `Game ${i + 1}`, kind: 'added' }),
    );
    render(<RecentActivity onOpen={onOpen} entries={[...before, bulk]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(toggle()).toHaveFocus();
  });
});

describe('where each game is played, by what the library is on', () => {
  const games = () => [
    entry({ id: 1, kind: 'dropped', name: 'Super Meat Boy' }),
    entry({ id: 2, kind: 'dropped', name: 'Astro Bot', source: 'manual', platform: 'PS5' }),
  ];

  it('says it for every game, PC too, in a library on more than one platform', () => {
    mockLibrary = { main: 'PC', count: 2 };
    render(<RecentActivity onOpen={onOpen} entries={games()} />);
    const [pc, ps5] = rows();
    expect(pc).toHaveTextContent(/^Super Meat Boy PC Dropped$/);
    expect(ps5).toHaveTextContent(/^Astro Bot PS5 Dropped$/);
  });

  it('says it the same whichever platform most of the library is on', () => {
    mockLibrary = { main: 'PS5', count: 2 };
    render(<RecentActivity onOpen={onOpen} entries={games()} />);
    const [pc, ps5] = rows();
    expect(pc).toHaveTextContent(/^Super Meat Boy PC Dropped$/);
    expect(ps5).toHaveTextContent(/^Astro Bot PS5 Dropped$/);
  });

  it('says nothing in a library all on one platform', () => {
    mockLibrary = { main: 'PS5', count: 1 };
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[entry({ kind: 'dropped', name: 'Astro Bot', source: 'manual', platform: 'PS5' })]}
      />,
    );
    expect(rows()[0]).toHaveTextContent(/^Astro Bot Dropped$/);
  });

  it('says only a console until the library is known, as before', () => {
    render(<RecentActivity onOpen={onOpen} entries={games()} />);
    const [pc, ps5] = rows();
    expect(pc).toHaveTextContent(/^Super Meat Boy Dropped$/);
    expect(ps5).toHaveTextContent(/^Astro Bot PS5 Dropped$/);
  });

  it("still doesn't say it twice for a game moved there", () => {
    mockLibrary = { main: 'PC', count: 2 };
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[entry({ kind: 'moved', to: 'Switch 2', source: 'manual', platform: 'Switch 2' })]}
      />,
    );
    expect(rows()[0]).not.toHaveTextContent('(Switch 2)');
  });
});

describe('the focus, when rows fold into a group', () => {
  const portal = (key: string, kind: ActivityKind) =>
    entry({ key, id: 7, name: 'Portal', kind, day: '2026-11-17' });
  const two = [portal('event-2', 'started'), portal('event-1', 'queued')];
  const three = [portal('event-3', 'finished'), ...two];
  const group = entry({
    key: 'updates-event-1',
    id: 7,
    name: 'Portal',
    day: '2026-11-17',
    lines: three.map((one) => one.lines[0]).reverse(),
    updates: three,
  });
  const other = entry({ key: 'event-9', id: 8, name: 'Celeste', kind: 'added', day: '2026-11-16' });

  it("goes on to the group its game's rows folded into", () => {
    const { rerender } = render(<RecentActivity onOpen={onOpen} entries={[...two, other]} />);
    screen.getByRole('button', { name: /^Portal Added to queue/ }).focus();

    rerender(<RecentActivity onOpen={onOpen} entries={[group, other]} />);
    expect(screen.getByRole('button', { name: 'Portal 3 updates' })).toHaveFocus();
  });

  it("stays where it is when it isn't on a row that went", () => {
    const { rerender } = render(<RecentActivity onOpen={onOpen} entries={[...two, other]} />);
    const celeste = screen.getByRole('button', { name: /^Celeste/ });
    celeste.focus();

    rerender(<RecentActivity onOpen={onOpen} entries={[group, other]} />);
    expect(celeste).toHaveFocus();
  });

  it("doesn't take the focus when it had moved off the list", () => {
    const { rerender } = render(<RecentActivity onOpen={onOpen} entries={[...two, other]} />);
    screen.getByRole('button', { name: /^Portal Added to queue/ }).focus();
    screen.getByRole('link', { name: 'Diary' }).focus();

    rerender(<RecentActivity onOpen={onOpen} entries={[group, other]} />);
    expect(screen.getByRole('link', { name: 'Diary' })).toHaveFocus();
  });

  it('finds the row a game is in now, for a dialog whose opener went', () => {
    render(<RecentActivity onOpen={onOpen} entries={[group, other]} />);
    expect(focusActivityRow(7)).toBe(true);
    expect(screen.getByRole('button', { name: 'Portal 3 updates' })).toHaveFocus();
    expect(focusActivityRow(99)).toBe(false);
  });
});

describe('when it happened', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const HOUR = 3_600_000;
  const on = (id: number, at: string, overrides: Parameters<typeof entry>[0] = {}) =>
    entry({
      key: `event-${id}`,
      id,
      name: `Game ${id}`,
      at,
      day: at.slice(0, 10) || null,
      ...overrides,
    });

  it('is said at the far end of each row, after its name: how long ago within the week', () => {
    const at = ago(2 * HOUR);
    render(<RecentActivity onOpen={onOpen} entries={[on(1, at, { name: 'Hades', rating: 9 })]} />);
    const time = within(rows()[0]).getByText('2h ago');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', at);
    // Part of the row's name, in the order shown: the game, when, what was done.
    expect(
      screen.getByRole('button', { name: /^Hades 2h ago Finished Rated 9\/10$/ }),
    ).toBeInTheDocument();
  });

  it('is the day once it is over a week old, and for a row that only has a day', () => {
    const old = ago(9 * 24 * HOUR);
    render(<RecentActivity onOpen={onOpen} entries={[on(1, old), on(2, '2025-08-20')]} />);
    expect(whens()).toEqual([activityDay(old.slice(0, 10)), 'Aug 20, 2025']);
  });

  it('says nothing for a row whose time is not known', () => {
    render(<RecentActivity onOpen={onOpen} entries={[on(1, '', { kind: 'playing' })]} />);
    expect(whens()).toEqual([null]);
    expect(rows()[0]).toHaveTextContent(/^Game 1 Started playing$/);
  });

  it('is one list, with no day beside its rows', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          on(3, '2026-11-17T20:00:00+00:00'),
          on(2, '2026-11-17T09:00:00+00:00'),
          on(1, '2026-11-16T09:00:00+00:00'),
        ]}
      />,
    );
    expect(section().queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(section().getAllByRole('list')).toHaveLength(1);
    expect(rows()).toHaveLength(3);
  });

  it('says the day of a finish the player dated, at its far end and not in its sentence', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[on(1, '2024-05-01', { name: 'Hades', rating: 8 })]}
      />,
    );
    expect(whens()).toEqual(['May 1, 2024']);
    expect(lineOf(rows()[0], 'Finished')).toHaveTextContent(/^Finished$/);
  });

  it('keeps the comma of a date against its number', () => {
    render(<RecentActivity onOpen={onOpen} entries={[on(1, '2025-08-20')]} />);
    const time = rows()[0].querySelector('time')!;
    expect(time).toHaveTextContent(/^Aug 20, 2025$/);
    // Fixed-width digits would push it away.
    expect(time).not.toHaveClass('tabular-nums');
  });
});

describe("on someone else's profile, with nothing to open", () => {
  const theirs = { main: 'PC', count: 2 };
  const three = [
    entry({ key: '0', id: undefined, name: 'Hades', rating: 9 }),
    entry({
      key: '1',
      id: undefined,
      name: 'Celeste',
      kind: 'playing',
      source: 'manual',
      platform: 'Switch',
    }),
    entry({ key: '2', id: undefined, name: 'Tunic', kind: 'favorite' }),
  ];

  it('says the same rows, in the same words, as only something to read', () => {
    render(<RecentActivity entries={three} library={theirs} />);
    expect(rows().map((row) => row.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Hades PC Finished Rated 9/10',
      'Celeste Switch Started playing',
      'Tunic PC Added to favorites',
    ]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("names platforms by the profile's library, not the visitor's own", () => {
    // Their library is all on one platform: nothing to say.
    render(<RecentActivity entries={three} library={{ main: 'PC', count: 1 }} />);
    expect(rows()[0]).toHaveTextContent(/^Hades Finished Rated 9\/10$/);
  });

  it("leads nowhere: no Diary link, which is the player's own", () => {
    render(<RecentActivity entries={three} library={theirs} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('still unfolds a folded row, to rows that open nothing', () => {
    const updates = [
      entry({ key: '0-0', id: undefined, name: 'Portal', rating: 10 }),
      entry({ key: '0-1', id: undefined, name: 'Portal', kind: 'played', minutes: 90 }),
      entry({ key: '0-2', id: undefined, name: 'Portal', kind: 'started' }),
    ];
    render(
      <RecentActivity
        library={theirs}
        entries={[
          entry({
            key: '0',
            id: undefined,
            name: 'Portal',
            lines: updates.map((u) => u.lines[0]).reverse(),
            updates,
          }),
        ]}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Portal 3 updates' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it('still shows more, and hands the focus to the first row it added', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      entry({ key: String(i), id: undefined, name: `Game ${i + 1}`, kind: 'favorite' }),
    );
    render(<RecentActivity entries={many} library={theirs} />);
    expect(rows()).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(rows()).toHaveLength(8);
    expect(rows()[6].firstElementChild).toHaveFocus();
  });
});

describe('a finish', () => {
  const finish = (line: Record<string, unknown>) => ({
    key: 'event-1',
    id: 1,
    name: 'Hades',
    header_image: null,
    source: 'steam',
    platform: 'PC',
    day: '2026-11-17',
    at: '2026-11-17T20:00:00Z',
    rating: null,
    lines: [{ kind: 'finished' as const, ...line }],
  });

  it('says what there is to say about it under its line: rating, hours, days and the pick', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[finish({ rating: 9, minutes: 2550, days: 11, pickedBy: 'questions' })]}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: /^Hades .* Finished Rated 9\/10 Played for 42h 30m over 12 days Picked by Pick My Game$/,
      }),
    ).toBeInTheDocument();
  });

  it('has nothing under its line when none of it is known, or for a finish on the day it began', () => {
    render(<RecentActivity onOpen={onOpen} entries={[finish({ days: 0 })]} />);
    expect(screen.getByRole('button', { name: /^Hades .* Finished$/ })).toBeInTheDocument();
  });
});

describe('a recent finish', () => {
  const entry = (line: Record<string, unknown>, day: string) => ({
    key: 'event-' + day,
    id: 1,
    name: 'Hades',
    header_image: null,
    source: 'steam',
    platform: 'PC',
    day,
    at: day,
    rating: null,
    lines: [{ kind: 'finished' as const, ...line }],
  });
  const daysAgo = (days: number) => {
    const day = new Date();
    day.setDate(day.getDate() - days);
    return toLocalIsoDate(day);
  };

  it('washes a finish of the last thirty days in green, and not one before', () => {
    render(
      <RecentActivity
        entries={[
          entry({}, daysAgo(30)),
          { ...entry({}, daysAgo(31)), key: 'older', name: 'Celeste' },
        ]}
      />,
    );
    const [recent, older] = rows();
    expect(recent.firstElementChild!.className).toContain('from-emerald-500');
    expect(older.firstElementChild!.className).not.toContain('from-emerald-500');
  });

  it('is a plain row once its game is no longer finished: no wash, no green, no figures', () => {
    render(
      <RecentActivity
        entries={[
          entry({ rating: 9, minutes: 600 }, daysAgo(1)),
          { ...entry({ undone: true }, daysAgo(2)), key: 'undone', name: 'Celeste' },
        ]}
      />,
    );
    const [stands, undone] = rows();
    expect(stands.firstElementChild!.className).toContain('from-emerald-500');
    expect(within(stands).getByText('Finished')).toHaveClass('text-emerald-400');
    expect(within(stands).getByText('Played for')).toBeInTheDocument();

    expect(undone.firstElementChild!.className).not.toContain('from-emerald-500');
    expect(within(undone).getByText('Finished')).toHaveClass('text-ink-300');
    expect(within(undone).getByText('Finished')).not.toHaveClass('text-emerald-400');
    // The one line that says what happened, with no line of figures under it.
    expect(stands.querySelectorAll('[data-line]')).toHaveLength(2);
    expect(undone.querySelectorAll('[data-line]')).toHaveLength(1);
  });
});
