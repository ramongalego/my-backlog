import { ALL_YEARS, diaryTimeline } from '@/lib/diary/timeline';

const entry = (name: string, finished_at: string | null) => ({ name, finished_at });

// As the loader sends them: the most recently finished first.
const entries = [
  entry('Hades', '2026-03-20T12:00:00Z'),
  entry('Celeste', '2026-03-02T12:00:00Z'),
  entry('Tunic', '2026-01-15T12:00:00Z'),
  entry('Portal 2', '2025-11-30T12:00:00Z'),
  entry('Zelda', null),
  entry('Braid', null),
];
const now = new Date('2026-06-01T12:00:00Z');

const shape = (timeline: ReturnType<typeof diaryTimeline<(typeof entries)[number]>>) =>
  timeline.groups.map((y) => [y.year, y.months.map((m) => [m.key, m.entries.map((e) => e.name)])]);

it('groups entries by the year and month they were finished, in the order given', () => {
  expect(shape(diaryTimeline(entries, ALL_YEARS, now))).toEqual([
    [
      '2026',
      [
        ['2026-03', ['Hades', 'Celeste']],
        ['2026-01', ['Tunic']],
      ],
    ],
    ['2025', [['2025-11', ['Portal 2']]]],
  ]);
});

it('offers every year that has a dated entry, newest first', () => {
  expect(diaryTimeline(entries, ALL_YEARS, now).years).toEqual(['2026', '2025']);
  // Whichever year is being shown.
  expect(diaryTimeline(entries, '2025', now).years).toEqual(['2026', '2025']);
});

it('lists undated entries by name, with every year only', () => {
  expect(diaryTimeline(entries, ALL_YEARS, now).undated.map((e) => e.name)).toEqual([
    'Braid',
    'Zelda',
  ]);
  expect(diaryTimeline(entries, '2026', now).undated).toEqual([]);
});

it('shows one year when asked for it', () => {
  expect(shape(diaryTimeline(entries, '2025', now))).toEqual([
    ['2025', [['2025-11', ['Portal 2']]]],
  ]);
  expect(diaryTimeline(entries, '2019', now).groups).toEqual([]);
});

describe('the summary line', () => {
  it('counts every entry, and how many were finished this year', () => {
    expect(diaryTimeline(entries, ALL_YEARS, now).summary).toBe('6 games finished · 3 this year');
  });

  it('leaves this year out when nothing was finished in it', () => {
    expect(diaryTimeline(entries, ALL_YEARS, new Date('2028-01-01T12:00:00Z')).summary).toBe(
      '6 games finished',
    );
  });

  it('counts one year when it is the one shown', () => {
    expect(diaryTimeline(entries, '2026', now).summary).toBe('3 games finished in 2026');
    expect(diaryTimeline(entries, '2025', now).summary).toBe('1 game finished in 2025');
  });

  it('says so for an empty diary', () => {
    expect(diaryTimeline([], ALL_YEARS, now).summary).toBe('0 games finished');
  });
});

it("doesn't reorder the list it was given", () => {
  const before = entries.map((e) => e.name);
  diaryTimeline(entries, ALL_YEARS, now);
  expect(entries.map((e) => e.name)).toEqual(before);
});
