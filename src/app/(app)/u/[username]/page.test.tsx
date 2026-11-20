/**
 * @jest-environment node
 */
import type { ReactElement } from 'react';
import ProfilePage, { generateMetadata } from './page';
import { getPublicProfile } from '@/lib/server/public-profile';
import { ownUsername } from '@/lib/server/own-username';
import { prefetchForUser } from '@/lib/data/prefetch';
import type { PublicProfile } from '@/lib/account/public-profile';

jest.mock('@/lib/server/public-profile', () => ({ getPublicProfile: jest.fn() }));
jest.mock('@/lib/server/own-username', () => ({ ownUsername: jest.fn() }));
jest.mock('@/lib/data/prefetch', () => ({ prefetchForUser: jest.fn(async () => ({})) }));
jest.mock('@/lib/data/queries', () => ({
  queries: new Proxy({}, { get: (_, name) => () => ({ queryKey: [name] }) }),
}));
jest.mock('./View', () => ({ __esModule: true, default: () => null }));
// The lookups are shared between the metadata and the page with React's cache().
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: <T,>(fn: T) => fn,
}));
const mockNotFound = jest.fn(() => {
  throw new Error('NOT_FOUND');
});
const mockRedirect = jest.fn((to: string) => {
  throw new Error(`REDIRECT ${to}`);
});
jest.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  redirect: (to: string) => mockRedirect(to),
}));

const mistkai: PublicProfile = {
  username: 'mistkai',
  name: 'Mist Kai',
  avatar: null,
  figures: { backlog: 4, finished: 2, finishedThisYear: 1, hours: 33, avgRating: null },
  ratings: null,
  favorites: [],
  platforms: [],
  library: { main: null, count: 0 },
  activity: [],
  activityDays: {},
};

const at = (username: string) => ({ params: Promise.resolve({ username }) });
/** Who is signed in, by their username; null for a signed-out visitor. */
const signedInAs = (username: string | null) =>
  jest.mocked(ownUsername).mockResolvedValue(username);
/** What the page drew: the player's own profile, or the one anyone sees. */
const drawn = async (username: string) => {
  const page = (await ProfilePage(at(username))) as ReactElement;
  return typeof page.type === 'function' && page.type.name === 'OwnProfile'
    ? 'OwnProfile'
    : 'visitor';
};

beforeEach(() => {
  jest.clearAllMocks();
  signedInAs(null);
  jest.mocked(getPublicProfile).mockResolvedValue(mistkai);
});

describe('what the page is called', () => {
  it('is the name with the username, kept out of search engines', async () => {
    expect(await generateMetadata(at('mistkai'))).toEqual({
      title: 'Mist Kai (@mistkai)',
      description: 'What Mist Kai plays, on MyBacklog.',
      robots: { index: false, follow: false },
    });
  });

  it('is the username alone for a profile that goes by it', async () => {
    jest.mocked(getPublicProfile).mockResolvedValue({ ...mistkai, name: 'mistkai' });
    expect((await generateMetadata(at('mistkai'))).title).toBe('@mistkai');
  });

  it("is the missing page's for a profile that does not exist", async () => {
    jest.mocked(getPublicProfile).mockResolvedValue(null);
    expect(await generateMetadata(at('nobody'))).toEqual({ title: 'Page not found' });
  });

  it('is Profile for the player looking at their own, private or not', async () => {
    signedInAs('mistkai');
    jest.mocked(getPublicProfile).mockResolvedValue(null);
    expect(await generateMetadata(at('mistkai'))).toEqual({
      title: 'Profile',
      description: 'Your favorite games and what you have been playing.',
      robots: { index: false, follow: false },
    });
  });
});

it('is a missing page for a username nobody has', async () => {
  jest.mocked(getPublicProfile).mockResolvedValue(null);
  await expect(ProfilePage(at('nobody'))).rejects.toThrow('NOT_FOUND');
});

it('sends an address typed with capitals to the real one', async () => {
  await expect(ProfilePage(at('MistKai'))).rejects.toThrow('REDIRECT /u/mistkai');
});

it('is the profile anyone sees for someone else, signed in or not', async () => {
  expect(await drawn('mistkai')).toBe('visitor');
  expect(getPublicProfile).toHaveBeenLastCalledWith('mistkai');

  signedInAs('someoneelse');
  expect(await drawn('mistkai')).toBe('visitor');
  expect(prefetchForUser).not.toHaveBeenCalled();
  expect(mockRedirect).not.toHaveBeenCalled();
});

describe('the player looking at their own', () => {
  beforeEach(() => signedInAs('mistkai'));

  it('gets their own profile at the same address, with nowhere to be sent', async () => {
    expect(await drawn('mistkai')).toBe('OwnProfile');
    expect(mockRedirect).not.toHaveBeenCalled();
    // Read from their own rows, as their other pages are: never the copy others get.
    expect(getPublicProfile).not.toHaveBeenCalled();
  });

  it('reads what the profile is drawn from, streaming the library', async () => {
    const page = (await ProfilePage(at('mistkai'))) as ReactElement;
    await (page.type as () => Promise<unknown>)();
    expect(prefetchForUser).toHaveBeenCalledTimes(1);
    const build = jest.mocked(prefetchForUser).mock.calls[0][0];
    const asked = build({} as never, 'user-1') as unknown as {
      queryKey: string[];
      stream?: boolean;
    }[];
    expect(asked.map((query) => query.queryKey[0])).toEqual([
      'gamesList',
      'playing',
      'favoriteGames',
      'history',
      'playedPicks',
      'activityHistory',
      'queue',
    ]);
    expect(asked.filter((query) => query.stream).map((query) => query.queryKey[0])).toEqual([
      'gamesList',
    ]);
  });

  it('gets it when the profile is private, which is a missing page for anyone else', async () => {
    jest.mocked(getPublicProfile).mockResolvedValue(null);
    expect(await drawn('mistkai')).toBe('OwnProfile');

    signedInAs(null);
    await expect(ProfilePage(at('mistkai'))).rejects.toThrow('NOT_FOUND');
  });

  it('is sent to the real address when they typed it with capitals', async () => {
    await expect(ProfilePage(at('MistKai'))).rejects.toThrow('REDIRECT /u/mistkai');
  });
});
