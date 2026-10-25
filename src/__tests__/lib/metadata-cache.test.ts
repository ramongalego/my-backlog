import { isCacheUsable, isRecentRelease, type CachedMetadata } from '@/lib/games/metadata-cache';
import { parseReleaseDate } from '@/lib/games/release-date';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-25T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();

const row = (overrides: Partial<CachedMetadata> = {}): CachedMetadata => ({
  app_id: 1,
  platform: 'PC',
  type: 'game',
  name: 'Game',
  genres: null,
  categories: ['Single-player'],
  description: null,
  release_date: 'Sep 28, 2010',
  header_image: null,
  steam_review_score: 90,
  steam_review_count: 1000,
  steam_review_weighted: 88,
  main_story_hours: 12,
  deck_compat: null,
  tags: null,
  synced_at: daysAgo(1),
  hltb_attempts: 0,
  ...overrides,
});

describe('isCacheUsable', () => {
  it('uses an older game with an HLTB time as-is', () => {
    expect(isCacheUsable(row({ synced_at: daysAgo(80) }), NOW)).toBe(true);
  });

  describe('games HLTB has no time for', () => {
    const missing = (attempts: number, lastTried: number) =>
      row({ main_story_hours: null, hltb_attempts: attempts, synced_at: daysAgo(lastTried) });

    it.each([
      [1, 3],
      [2, 7],
      [3, 14],
      [4, 28],
      [9, 28],
    ])('retries after %i misses once %i days have passed', (attempts, days) => {
      expect(isCacheUsable(missing(attempts, days - 1), NOW)).toBe(true);
      expect(isCacheUsable(missing(attempts, days), NOW)).toBe(false);
    });
  });

  describe('recent releases', () => {
    const recent = (lastSynced: number) =>
      row({ release_date: daysAgoText(120), synced_at: daysAgo(lastSynced) });

    it('re-checks the HLTB time once a month', () => {
      expect(isCacheUsable(recent(29), NOW)).toBe(true);
      expect(isCacheUsable(recent(30), NOW)).toBe(false);
    });

    it('stops re-checking a year after release', () => {
      expect(
        isCacheUsable(row({ release_date: daysAgoText(400), synced_at: daysAgo(45) }), NOW),
      ).toBe(true);
    });
  });
});

describe('isRecentRelease', () => {
  it('ignores unreleased and unknown dates', () => {
    expect(isRecentRelease('To be announced', NOW)).toBe(false);
    expect(isRecentRelease(null, NOW)).toBe(false);
    expect(isRecentRelease(daysAgoText(-30), NOW)).toBe(false);
  });
});

describe('parseReleaseDate', () => {
  it('reads both of the formats Steam uses', () => {
    expect(parseReleaseDate('Sep 28, 2010')).toBe(parseReleaseDate('28 Sep, 2010'));
    expect(parseReleaseDate('Sep 28, 2010')).not.toBeNull();
  });

  it('returns null for text that is not a date', () => {
    expect(parseReleaseDate('To be announced')).toBeNull();
    expect(parseReleaseDate('Coming soon')).toBeNull();
    expect(parseReleaseDate(null)).toBeNull();
  });
});

function daysAgoText(days: number): string {
  return new Date(NOW - days * DAY).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
