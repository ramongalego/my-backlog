import type { GameItem } from '@/lib/data/loaders';

/** A library game for the profile's tests: a backlog Steam game unless told otherwise. */
export const libraryGame = (overrides: Partial<GameItem> = {}): GameItem => ({
  id: 1,
  source: 'steam',
  platform: 'PC',
  app_id: 1,
  name: 'Test Game',
  playtime_forever: 0,
  steam_review_score: null,
  steam_review_count: null,
  critic_score: null,
  critic_count: null,
  steam_review_weighted: null,
  header_image: 'https://example.com/art.jpg',
  main_story_hours: null,
  status: 'backlog',
  notes: null,
  rating: null,
  finished_at: null,
  dropped_at: null,
  tags: null,
  created_at: '2026-01-01T00:00:00Z',
  release_date: null,
  last_played_at: null,
  ...overrides,
});
