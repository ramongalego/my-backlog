import { fireEvent, render, screen, within } from '@testing-library/react';
import { RecentActivity } from '@/components/profile/RecentActivity';
import {
  activityDay,
  type ActivityEntry,
  type ActivityKind,
  type ActivityLine,
} from '@/lib/account/activity';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

/**
 * An entry about one thing (`kind`), or several (`lines`). A rating is on the
 * one line and on the entry, as the rules give it; with `lines`, each line
 * says its own.
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
/** The days the list says, top to bottom. */
const days = () =>
  section()
    .queryAllByRole('heading', { level: 3 })
    // As it is read out: the stamp drawn beside it is hidden from that.
    .map((heading) => heading.querySelector('.sr-only')?.textContent);
/** One line of a row, found by what it says happened: its label and what follows it. */
const lineOf = (row: HTMLElement, label: string) => within(row).getByText(label).parentElement!;

it('says what happened to each game, when, and where it was played', () => {
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
  // A line like any other: what happened, with no "since", then that it is
  // the one being played. Its day is beside it.
  expect(playing).toHaveTextContent(/^Ocarina of Time Playing now on Switch 2$/);
  expect(finished).toHaveTextContent(/^Fire Emblem: Fortune's Weave Finished on Switch 2 9\/10$/);
  // A Steam game played on Steam names no platform, as on its card.
  expect(dropped).toHaveTextContent(/^Super Meat Boy Dropped$/);
  expect(days()).toEqual(['2026-11-13', '2026-10-19', '2026-04-11'].map((day) => activityDay(day)));
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
  expect(screen.getByText('Playing now')).toHaveClass('text-accent-400');
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
  expect(within(playing).getByText('Playing now')).toHaveClass('text-accent-400');
  expect(within(started).getByText('Started playing')).toHaveClass('text-ink-300');
  expect(within(started).getByText('Started playing')).not.toHaveClass('text-accent-400');
  expect(within(playing).queryByText('Started playing')).not.toBeInTheDocument();
});

it('says the game being played is, in words, and not one started once and since stopped', () => {
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
  expect(playing).toHaveTextContent(/^Hades Playing now$/);
  expect(started).toHaveTextContent(/^Celeste Started playing$/);
  expect(within(started).queryByText('Playing now')).not.toBeInTheDocument();
  // In the row's name too.
  expect(screen.getByRole('button', { name: 'Hades Playing now' })).toBeInTheDocument();
});

it('says "Playing now" on the line of the start only, in a row with more lines', () => {
  render(
    <RecentActivity
      onOpen={onOpen}
      entries={[
        entry({
          name: 'Hades',
          source: 'manual',
          platform: 'Switch',
          lines: [{ kind: 'queued' }, { kind: 'playing' }, { kind: 'played', minutes: 45 }],
        }),
      ]}
    />,
  );
  const [row] = rows();
  expect(lineOf(row, 'Playing now')).toHaveTextContent(/^Playing now$/);
  expect(within(row).getAllByText('Playing now')).toHaveLength(1);
  expect(row).toHaveTextContent(/^Hades Added to queue Playing now Played 45m on Switch$/);
});

it('shows a game being played without a day when its start is not known', () => {
  render(<RecentActivity onOpen={onOpen} entries={[entry({ kind: 'playing', day: null })]} />);
  expect(rows()[0]).toHaveTextContent(/^Test Game Playing now$/);
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
  // Named by what it shows, in order.
  const hades = screen.getByRole('button', { name: /^Hades Finished 9\/10$/ });
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
      entries={[
        { ...queued, lines: [{ kind: 'queued' }, { kind: 'finished', rating: 9 }], rating: 9 },
      ]}
    />,
  );
  const finished = screen.getByRole('button', { name: /^Hades Added to queue Finished/ });
  expect(finished).toBe(row);
  expect(finished).toHaveFocus();
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
  ] as const)('says %o as "%s", under its day', (what, said) => {
    render(<RecentActivity onOpen={onOpen} entries={[entry({ ...what, day: '2026-11-17' })]} />);
    expect(rows()[0]).toHaveTextContent(`Test Game ${said}`);
    expect(rows()[0]).not.toHaveTextContent(activityDay('2026-11-17'));
    expect(days()).toEqual([activityDay('2026-11-17')]);
  });

  it('shows the rating a game was given', () => {
    render(<RecentActivity onOpen={onOpen} entries={[entry({ kind: 'rated', rating: 8 })]} />);
    expect(rows()[0]).toHaveTextContent(/^Test Game Rated 8\/10$/);
  });

  it('says a rating given by itself as its own text, with no second rating after it', () => {
    render(<RecentActivity onOpen={onOpen} entries={[entry({ kind: 'rated', rating: 8 })]} />);
    const [row] = rows();
    // The line's label is the rating: neutral, and the only "8/10" in the row.
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
    // Neither is a status: both neutral.
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
    expect(rows()[0]).not.toHaveTextContent(' on Switch 2');
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

describe('several things about one game', () => {
  const portal = entry({
    id: 7,
    name: 'Portal',
    source: 'manual',
    platform: 'Switch',
    lines: [{ kind: 'queued' }, { kind: 'played', minutes: 90 }, { kind: 'finished', rating: 10 }],
    day: '2026-11-17',
    rating: 10,
  });

  it('is one row: each thing in the order it happened, the console once, after the last', () => {
    render(<RecentActivity onOpen={onOpen} entries={[portal]} />);
    expect(rows()).toHaveLength(1);
    expect(
      screen.getByRole('button', {
        name: 'Portal Added to queue Played 1h 30m Finished on Switch 10/10',
      }),
    ).toBeInTheDocument();
    expect(days()).toEqual([activityDay('2026-11-17')]);
  });

  it('draws the rating inside the line it came with, not at the end of the row', () => {
    render(<RecentActivity onOpen={onOpen} entries={[portal]} />);
    const [row] = rows();
    const rating = within(row).getByText('10/10');
    // On the Finished line, after its label and the console.
    const finished = lineOf(row, 'Finished');
    expect(finished).toContainElement(rating);
    expect(finished).toHaveTextContent(/^Finished on Switch 10\/10$/);
    // Not on the first line, nor on the one between.
    expect(lineOf(row, 'Added to queue')).toHaveTextContent(/^Added to queue$/);
    expect(lineOf(row, 'Played 1h 30m')).toHaveTextContent(/^Played 1h 30m$/);
    expect(within(row).getAllByText('10/10')).toHaveLength(1);
    // A star beside it, as a rating reads everywhere.
    expect(rating.parentElement!.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('keeps the rating on its finish when more happened to the game after it', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          entry({
            name: 'Portal',
            source: 'manual',
            platform: 'Switch',
            lines: [{ kind: 'finished', on: '2026-11-10', rating: 9 }, { kind: 'favorite' }],
            day: '2026-11-17',
            rating: 9,
          }),
        ]}
      />,
    );
    const [row] = rows();
    // After the label and its own day; the console is on the last line.
    expect(lineOf(row, 'Finished')).toHaveTextContent(
      new RegExp(`^Finished ${activityDay('2026-11-10')} 9/10$`),
    );
    expect(lineOf(row, 'Added to favorites')).toHaveTextContent(/^Added to favorites on Switch$/);
  });

  it('draws the rating last on its line: after the label, its own day and the console', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          entry({
            source: 'manual',
            platform: 'Switch',
            lines: [{ kind: 'dropped', on: '2026-11-10', rating: 4 }],
            day: '2026-11-17',
            rating: 4,
          }),
        ]}
      />,
    );
    expect(lineOf(rows()[0], 'Dropped')).toHaveTextContent(
      new RegExp(`^Dropped ${activityDay('2026-11-10')} on Switch 4/10$`),
    );
  });

  it('draws each rating on its own line when a finish is rated again', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          entry({
            lines: [
              { kind: 'finished', rating: 10 },
              { kind: 'rated', rating: 8 },
            ],
            // The latest of them, which the row doesn't draw a second time.
            rating: 8,
          }),
        ]}
      />,
    );
    expect(rows()[0]).toHaveTextContent(/^Test Game Finished 10\/10 Rated 8\/10$/);
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

  it('has dots between its lines that say nothing aloud', () => {
    render(<RecentActivity onOpen={onOpen} entries={[portal]} />);
    // One set of dots between each two lines, hidden from screen readers.
    const dots = rows()[0].querySelectorAll('.border-dotted');
    expect(dots).toHaveLength(2);
    dots.forEach((dot) => expect(dot).toHaveAttribute('aria-hidden', 'true'));
  });

  it('has no dots in a row about one thing', () => {
    render(<RecentActivity onOpen={onOpen} entries={[entry({})]} />);
    expect(rows()[0].querySelector('.border-dotted')).toBeNull();
  });

  it('counts as one of the six rows', () => {
    const others = Array.from({ length: 5 }, (_, i) =>
      entry({ key: `event-${i}`, id: i + 20, name: `Game ${i}` }),
    );
    render(<RecentActivity onOpen={onOpen} entries={[portal, ...others]} />);
    expect(rows()).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /^Show \d+ more$/ })).not.toBeInTheDocument();
  });
});

describe('the days', () => {
  const on = (key: string, day: string | null, overrides: Parameters<typeof entry>[0] = {}) =>
    entry({ key, id: Number(key.replace(/\D/g, '')), name: `Game ${key}`, day, ...overrides });

  it('says a day once, for all the rows of it', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          on('event-3', '2026-11-17'),
          on('event-2', '2026-11-17'),
          on('event-1', '2026-11-16'),
        ]}
      />,
    );
    expect(days()).toEqual([activityDay('2026-11-17'), activityDay('2026-11-16')]);
    expect(rows()).toHaveLength(3);
    // Each day's rows are a list of their own, under it.
    const lists = section().getAllByRole('list');
    expect(lists.map((list) => within(list).getAllByRole('listitem').length)).toEqual([2, 1]);
  });

  it('draws the day as a stamp, its number over its month, and reads it as one date', () => {
    render(<RecentActivity onOpen={onOpen} entries={[on('event-1', '2026-11-17')]} />);
    const heading = section().getByRole('heading', { level: 3, name: activityDay('2026-11-17') });
    const stamp = heading.querySelector('[aria-hidden="true"]')!;
    expect([...stamp.children].map((part) => part.textContent)).toEqual(['17', 'Nov']);
  });

  it('says the year beside the month, on the same line, for a day in another year', () => {
    render(<RecentActivity onOpen={onOpen} entries={[on('event-1', '2025-08-20')]} />);
    // Still read as one date.
    const heading = section().getByRole('heading', { level: 3, name: 'Aug 20, 2025' });
    expect(days()).toEqual(['Aug 20, 2025']);
    const stamp = heading.querySelector('[aria-hidden="true"]')!;
    expect([...stamp.children].map((part) => part.textContent)).toEqual(['20', 'Aug 2025']);
  });

  it('keeps the stamp in view from `sm` while its rows scroll past', () => {
    render(<RecentActivity onOpen={onOpen} entries={[on('event-1', '2026-11-17')]} />);
    const stamp = section()
      .getByRole('heading', { level: 3 })
      .querySelector('[aria-hidden="true"]')!;
    expect(stamp).toHaveClass('sm:sticky', 'sm:top-20');
    // Only from `sm`: on phones the date is above its rows, not beside them.
    expect(stamp).not.toHaveClass('sticky');
  });

  it('says the day a game was finished or dropped when that is not the day it was logged', () => {
    render(
      <RecentActivity
        onOpen={onOpen}
        entries={[
          entry({
            lines: [{ kind: 'finished', on: '2026-11-10', rating: 7 }],
            day: '2026-11-17',
            rating: 7,
          }),
        ]}
      />,
    );
    expect(rows()[0]).toHaveTextContent(`Test Game Finished ${activityDay('2026-11-10')} 7/10`);
    expect(days()).toEqual([activityDay('2026-11-17')]);
  });

  it('has no day beside a row whose day is not known', () => {
    render(<RecentActivity onOpen={onOpen} entries={[on('event-1', null, { kind: 'playing' })]} />);
    expect(days()).toEqual([]);
    expect(rows()).toHaveLength(1);
  });

  it('carries a day on under the same date when Show more adds to it', () => {
    const many = Array.from({ length: 8 }, (_, i) => on(`event-${i + 1}`, '2026-11-17'));
    render(<RecentActivity onOpen={onOpen} entries={many} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(days()).toEqual([activityDay('2026-11-17')]);
    expect(rows()).toHaveLength(8);
  });
});

describe('a long list', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      entry({ key: `event-${i}`, id: i + 1, name: `Game ${i + 1}`, kind: 'added' }),
    );
  // "Show 6 more": it says how many the next press adds.
  const showMore = () => screen.queryByRole('button', { name: /^Show \d+ more$/ });
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

  it('says how many the next press adds: six, or fewer when fewer are left', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    expect(showMore()).toHaveAccessibleName('Show 6 more');

    fireEvent.click(showMore()!);
    expect(showMore()).toHaveAccessibleName('Show 2 more');
  });

  it('says "Show 2 more" when two are left, and "Show 1 more" for one', () => {
    const { unmount } = render(<RecentActivity onOpen={onOpen} entries={many(8)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(rows()).toHaveLength(8);
    expect(showMore()).not.toBeInTheDocument();
    unmount();

    render(<RecentActivity onOpen={onOpen} entries={many(7)} />);
    expect(showMore()).toHaveAccessibleName('Show 1 more');
  });

  it('is a text button with a chevron, not an underlined link', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    fireEvent.click(showMore()!);
    for (const button of [showMore()!, showFewer()!]) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button.className).not.toMatch(/underline/);
      // The chevron is drawn only: the name is the words.
      expect(button.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    }
    // The Diary link is the section's only link.
    expect(section().getAllByRole('link')).toHaveLength(1);
  });

  it('offers Show fewer once more than six rows show, beside Show more', () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    expect(showFewer()).not.toBeInTheDocument();

    fireEvent.click(showMore()!);
    expect(showFewer()).toBeInTheDocument();
    // Beside it: Show more first, then the way back.
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
    // As it began: Show more adds six again, and there is nothing to go back from.
    expect(showMore()).toHaveAccessibleName('Show 6 more');
    expect(showFewer()).not.toBeInTheDocument();
  });

  it("moves the focus to the section's heading when Show fewer is pressed", () => {
    render(<RecentActivity onOpen={onOpen} entries={many(14)} />);
    fireEvent.click(showMore()!);
    // On a row that Show fewer takes away.
    expect(screen.getByRole('button', { name: /^Game 7 / })).toHaveFocus();

    fireEvent.click(showFewer()!);
    // The heading that names the section holds its id, and can take focus.
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
