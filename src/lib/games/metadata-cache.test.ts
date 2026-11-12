import {
  isCacheUsable,
  isRecentRelease,
  mergeForCache,
  needsOnlyHltb,
  needsSyncCheck,
  type CachedMetadata,
} from '@/lib/games/metadata-cache';
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
      // Past the table the wait keeps growing, a month per miss.
      [5, 56],
      [6, 84],
    ])('retries after %i misses once %i days have passed', (attempts, days) => {
      expect(isCacheUsable(missing(attempts, days - 1), NOW)).toBe(true);
      expect(isCacheUsable(missing(attempts, days), NOW)).toBe(false);
    });

    it('stops retrying between full refreshes once the wait outgrows them', () => {
      // 7 misses wait 112 days, longer than the 90 a cache row lives: the next
      // try is the full refresh, not every visit from day 28 on.
      for (const age of [28, 45, 89]) {
        expect(isCacheUsable(missing(7, age), NOW)).toBe(true);
        expect(needsOnlyHltb(missing(7, age), NOW)).toBe(false);
      }
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

describe('mergeForCache', () => {
  const fresh = (hours: number | null, hltbUnavailable = false) => {
    const { hltb_attempts, ...snapshot } = row({ main_story_hours: hours, synced_at: daysAgo(0) });
    void hltb_attempts;
    return { ...snapshot, hltbUnavailable };
  };

  it('counts a miss when HLTB has no time', () => {
    expect(
      mergeForCache(fresh(null), row({ main_story_hours: null, hltb_attempts: 1 })).hltb_attempts,
    ).toBe(2);
  });

  it('resets the count once HLTB has a time', () => {
    expect(
      mergeForCache(fresh(9), row({ main_story_hours: null, hltb_attempts: 3 })).hltb_attempts,
    ).toBe(0);
  });

  it('does not count a rate-limited lookup as a miss', () => {
    const merged = mergeForCache(fresh(null, true), null);
    expect(merged.hltb_attempts).toBe(0);
    // So the very next sync tries again.
    expect(isCacheUsable(merged, NOW)).toBe(false);
  });

  it('keeps the known time when HLTB was too busy to ask', () => {
    const merged = mergeForCache(
      fresh(null, true),
      row({ main_story_hours: 12, hltb_attempts: 0 }),
    );
    expect(merged.main_story_hours).toBe(12);
  });

  it('never writes the busy flag into the cache', () => {
    expect(mergeForCache(fresh(null, true), null)).not.toHaveProperty('hltbUnavailable');
  });
});

describe('needsOnlyHltb', () => {
  it('picks fresh games whose missing time is due a retry', () => {
    expect(needsOnlyHltb(row({ main_story_hours: null, hltb_attempts: 0 }), NOW)).toBe(true);
  });

  it('leaves games still waiting out their backoff', () => {
    expect(
      needsOnlyHltb(row({ main_story_hours: null, hltb_attempts: 2, synced_at: daysAgo(1) }), NOW),
    ).toBe(false);
  });

  it('leaves stale rows, games with a time, and non-games to the full sync', () => {
    expect(needsOnlyHltb(row({ main_story_hours: null, synced_at: daysAgo(120) }), NOW)).toBe(
      false,
    );
    expect(needsOnlyHltb(row({ main_story_hours: 12 }), NOW)).toBe(false);
    expect(needsOnlyHltb(row({ main_story_hours: null, type: 'dlc' }), NOW)).toBe(false);
  });
});

describe('needsSyncCheck', () => {
  const game = (overrides = {}) => ({
    type: 'game',
    categories: ['Single-player'],
    metadata_synced: true,
    main_story_hours: 12,
    release_date: 'Sep 28, 2010',
    ...overrides,
  });

  it('checks a game that was never synced', () => {
    expect(needsSyncCheck(game({ metadata_synced: false, type: null }), NOW)).toBe(true);
  });

  it('checks a synced game still missing its time to beat, or released recently', () => {
    expect(needsSyncCheck(game({ main_story_hours: null }), NOW)).toBe(true);
    expect(needsSyncCheck(game({ release_date: 'Aug 1, 2026' }), NOW)).toBe(true);
  });

  it('leaves a synced game with its time alone', () => {
    expect(needsSyncCheck(game(), NOW)).toBe(false);
  });

  it("leaves a game Steam has no store page for: it's asked once, not every visit", () => {
    // Delisted: synced, but nothing came back, so it has no type or time.
    expect(
      needsSyncCheck(game({ type: null, categories: null, main_story_hours: null }), NOW),
    ).toBe(false);
  });

  it('leaves software, DLC and multiplayer-only games', () => {
    expect(needsSyncCheck(game({ type: 'dlc', main_story_hours: null }), NOW)).toBe(false);
    expect(
      needsSyncCheck(game({ categories: ['Multi-player'], main_story_hours: null }), NOW),
    ).toBe(false);
  });
});
