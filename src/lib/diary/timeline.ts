import { getMonthKey } from './date-utils';

interface Finished {
  name: string;
  finished_at: string | null;
}

interface DiaryMonth<T> {
  /** "YYYY-MM" */
  key: string;
  entries: T[];
}

interface DiaryYear<T> {
  /** "YYYY" */
  year: string;
  months: DiaryMonth<T>[];
}

interface DiaryTimeline<T> {
  /** The year asked for if any entry has it, else ALL_YEARS. */
  year: string;
  /** Every year with a dated entry, newest first: what the year filter offers. */
  years: string[];
  /** The dated entries shown, by year then month, in the order they came. */
  groups: DiaryYear<T>[];
  /** Entries with no date, by name. Shown with every year, not with one. */
  undated: T[];
  /** The line under the title, e.g. "12 games finished · 3 this year". */
  summary: string;
}

export const ALL_YEARS = 'all';

/**
 * Entries keep the order they arrive in (latest finished first, from the
 * loader). A year no entry has (an old link) shows every year, not an empty page.
 */
export function diaryTimeline<T extends Finished>(
  entries: T[],
  asked: string = ALL_YEARS,
  now = new Date(),
): DiaryTimeline<T> {
  const dated = entries.filter((e) => e.finished_at);
  const years = [...new Set(dated.map((e) => e.finished_at!.slice(0, 4)))].sort((a, b) =>
    b.localeCompare(a),
  );
  const year = years.includes(asked) ? asked : ALL_YEARS;
  const everyYear = year === ALL_YEARS;
  const shown = everyYear ? dated : dated.filter((e) => e.finished_at!.startsWith(year));

  const groups: DiaryYear<T>[] = [];
  for (const entry of shown) {
    const entryYear = entry.finished_at!.slice(0, 4);
    const monthKey = getMonthKey(entry.finished_at!);

    let yearGroup = groups.find((g) => g.year === entryYear);
    if (!yearGroup) {
      yearGroup = { year: entryYear, months: [] };
      groups.push(yearGroup);
    }
    let monthGroup = yearGroup.months.find((m) => m.key === monthKey);
    if (!monthGroup) {
      monthGroup = { key: monthKey, entries: [] };
      yearGroup.months.push(monthGroup);
    }
    monthGroup.entries.push(entry);
  }

  const undated = everyYear
    ? entries.filter((e) => !e.finished_at).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // Counted like the Games page, so an empty diary reads "0 games finished"
  // rather than repeating the empty state below it.
  const total = everyYear ? entries.length : shown.length;
  const count = `${total} game${total === 1 ? '' : 's'} finished`;
  let summary = count;
  if (!everyYear) {
    summary = `${count} in ${year}`;
  } else {
    const thisYear = String(now.getFullYear());
    const thisYearCount = entries.filter((e) => e.finished_at?.startsWith(thisYear)).length;
    if (thisYearCount > 0) summary = `${count} · ${thisYearCount} this year`;
  }

  return { year, years, groups, undated, summary };
}
