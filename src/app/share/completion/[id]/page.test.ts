import { generateMetadata } from './page';
import { getSharedCompletion } from '@/lib/server/shared-completions';
import type { SharedCompletion } from '@/lib/share/completion';

jest.mock('@/lib/server/shared-completions', () => ({ getSharedCompletion: jest.fn() }));
// The lookup is shared between the metadata and the page with React's cache().
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: <T>(fn: T) => fn,
}));

const mockGetSharedCompletion = jest.mocked(getSharedCompletion);

const shared: SharedCompletion = {
  id: 'abc',
  game_name: 'Hades',
  header_image: null,
  playtime_minutes: 1530,
  main_story_hours: 20,
  rating: 9,
  games_finished: 3,
  total_games: 15,
  backlog_hours_removed: 20,
  next_game: null,
  created_at: '2026-11-13T12:00:00Z',
};

const describe_ = async (row: SharedCompletion | null) => {
  mockGetSharedCompletion.mockResolvedValue(row);
  return generateMetadata({ params: Promise.resolve({ id: 'abc' }) });
};

describe('the share page description', () => {
  it('says the hours and the rating', async () => {
    expect((await describe_(shared)).description).toBe('Finished Hades after 25.5h, rated 9/10');
  });

  it('leaves the hours out for a game without any (a console game)', async () => {
    const metadata = await describe_({ ...shared, playtime_minutes: 0 });
    expect(metadata.description).toBe('Finished Hades, rated 9/10');
  });

  it('leaves the rating out without one', async () => {
    const metadata = await describe_({ ...shared, rating: null });
    expect(metadata.description).toBe('Finished Hades after 25.5h');
  });

  it('is empty for a page that does not exist', async () => {
    expect(await describe_(null)).toEqual({});
  });
});
