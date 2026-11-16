import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProfilePage } from '@/hooks/useProfilePage';
import type { GameItem } from '@/lib/data/loaders';
import { libraryGame as game } from '@/lib/account/test-games';
import { queryKeys } from '@/lib/query-keys';
import { saveFavoriteGames } from '@/lib/client/favorites';
import { toast } from 'sonner';
import {
  removeAvatar,
  saveProfileName,
  squareAvatar,
  uploadAvatar,
} from '@/lib/client/profile-identity';
import { changeEmail, disconnectSteam } from '@/lib/client/account';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
// The game dialog has its own tests (it's the Games page's); here it's only handed on.
const mockOpenGame = jest.fn();
jest.mock('@/hooks/useLibraryGameDialog', () => ({
  useLibraryGameDialog: () => ({ gameDialog: null, openGame: mockOpenGame }),
}));
jest.mock('sonner', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('@/lib/client/favorites', () => ({ saveFavoriteGames: jest.fn(async () => {}) }));

let session: {
  user: { id: string; email?: string; created_at?: string } | null;
  profile: {
    steam_id: string | null;
    steam_username: string | null;
    steam_avatar: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};
const mockUpdateProfile = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => session,
  useUpdateSessionProfile: () => mockUpdateProfile,
}));
jest.mock('@/lib/client/profile-identity', () => ({
  saveProfileName: jest.fn(),
  uploadAvatar: jest.fn(),
  removeAvatar: jest.fn(),
  squareAvatar: jest.fn(),
}));
jest.mock('@/lib/client/account', () => ({
  changePassword: jest.fn(),
  changeEmail: jest.fn(),
  deleteAccount: jest.fn(),
  disconnectSteam: jest.fn(),
  sendPasswordReset: jest.fn(),
}));
const mockReload = jest.fn();
jest.mock('@/lib/reload', () => ({ reloadAtTop: () => mockReload() }));

const steamPlayer = {
  user: { id: 'user-1', email: 'player@example.com', created_at: '2026-01-18T10:00:00Z' },
  profile: {
    steam_id: '7656',
    steam_username: 'Ankrath',
    steam_avatar: 'https://avatars.steamstatic.com/a_full.jpg',
  },
};

/**
 * The profile for a library; `games` undefined leaves it still loading.
 * `picks` are the favorites saved (none unless given).
 */
function open(games?: GameItem[], playing: unknown = null, picks: number[] = []) {
  const client = new QueryClient();
  if (games) {
    client.setQueryData(queryKeys.games.list('user-1'), games);
    client.setQueryData(queryKeys.games.playing('user-1'), playing);
    client.setQueryData(queryKeys.games.favorites('user-1'), picks);
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProfilePage(), { wrapper }).result.current;
}

/** The same, kept live: for changing the favorites and reading what follows. */
function live(games: GameItem[], picks: number[] = []) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.games.list('user-1'), games);
  client.setQueryData(queryKeys.games.playing('user-1'), null);
  client.setQueryData(queryKeys.games.favorites('user-1'), picks);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useProfilePage(), { wrapper });
  return () => hook.result.current;
}

const finished = (id: number, name: string, rating: number, day: string) =>
  game({ id, name, status: 'finished', rating, finished_at: `${day}T00:00:00+00:00` });

beforeEach(() => {
  session = steamPlayer;
});

it('is who the account says: the Steam name and avatar, the email, when it was made', () => {
  const profile = open([]);
  expect(profile).toMatchObject({
    loading: false,
    name: 'Ankrath',
    avatar: 'https://avatars.steamstatic.com/a_full.jpg',
    email: 'player@example.com',
    memberSince: 'January 2026',
    steam: { username: 'Ankrath' },
  });
});

it('goes by the email without Steam, and has no Steam account to show', () => {
  session = {
    user: steamPlayer.user,
    profile: { steam_id: null, steam_username: null, steam_avatar: null },
  };
  expect(open([])).toMatchObject({ name: 'player', avatar: null, steam: null });
});

it('is loading until the library arrives', () => {
  expect(open()).toMatchObject({ loading: true, loadError: false });
});

it('draws everything from the library', () => {
  const profile = open(
    [
      finished(1, 'Castlevania: Aria of Sorrow', 10, '2025-08-20'),
      finished(2, 'Metaphor: ReFantazio', 9, '2024-11-09'),
      finished(3, 'Persona 5 Royal', 9, '2023-03-01'),
      finished(4, 'A Fine Game', 7, '2026-02-02'),
      game({
        id: 5,
        name: 'Ocarina of Time',
        status: 'playing',
        source: 'manual',
        platform: 'Switch 2',
      }),
      game({ id: 6, name: 'Hidden Tool', status: 'hidden' }),
      game({ id: 7, name: 'Mario Kart World', source: 'manual', platform: 'Switch 2' }),
    ],
    { id: 5, started_at: '2026-11-13T12:00:00Z' },
  );

  expect(profile.figures).toMatchObject({ games: 6, finished: 4 });
  // Nothing is a favorite until the player picks it, however it's rated.
  expect(profile.favorites).toEqual([]);
  // The game being played, then the newest finish.
  expect(profile.activity.map((e) => e.name).slice(0, 2)).toEqual([
    'Ocarina of Time',
    'A Fine Game',
  ]);
  // PC has five games, but one is hidden: listed by what the Games page would show.
  expect(profile.platforms).toEqual([
    { name: 'PC', count: 4 },
    { name: 'Switch 2', count: 2 },
  ]);
});

describe('favorites', () => {
  const library = [
    finished(1, 'Castlevania: Aria of Sorrow', 10, '2025-08-20'),
    finished(2, 'Metaphor: ReFantazio', 9, '2024-11-09'),
    finished(3, 'Persona 5 Royal', 9, '2023-03-01'),
    game({ id: 4, name: 'Celeste' }),
    game({ id: 5, name: 'Old Tool', status: 'hidden' }),
  ];

  it('are none until the player picks: nothing is filled in for them', () => {
    const profile = open(library);
    expect(profile.favorites).toEqual([]);
    expect(profile.favoritePicker.pickedIds).toEqual([]);
    // The picker has the whole library to pick from.
    expect(profile.favoritePicker.games).toHaveLength(5);
  });

  it('are the picked games once there are any, in the order picked', () => {
    const profile = open(library, null, [4, 2]);
    expect(profile.favorites).toEqual([
      // An unfinished game can be a favorite; it just has no rating to show.
      { id: 4, name: 'Celeste', header_image: 'https://example.com/art.jpg', rating: null },
      {
        id: 2,
        name: 'Metaphor: ReFantazio',
        header_image: 'https://example.com/art.jpg',
        rating: 9,
      },
    ]);
    expect(profile.favoritePicker.pickedIds).toEqual([4, 2]);
  });

  it('are picked on and off from the picker, each click building on the last', async () => {
    jest.mocked(saveFavoriteGames).mockClear();
    const profile = live(library);

    // Three clicks before the page has redrawn once.
    let after!: number[];
    await act(async () => {
      profile().favoritePicker.onToggle(4);
      profile().favoritePicker.onToggle(2);
      after = profile().favoritePicker.onToggle(1);
    });
    expect(after).toEqual([4, 2, 1]);
    // (The page hears of a change a moment after it's made.)
    await waitFor(() => expect(profile().favorites.map((g) => g.id)).toEqual([4, 2, 1]));
    // One save on its way at a time: the first click, then the rest as one.
    expect(jest.mocked(saveFavoriteGames).mock.calls.map(([ids]) => ids)).toEqual([[4], [4, 2, 1]]);

    await act(async () => {
      after = profile().favoritePicker.onToggle(2);
    });
    expect(after).toEqual([4, 1]);
  });

  it('are reordered and removed from the row itself', async () => {
    jest.mocked(saveFavoriteGames).mockClear();
    const profile = live(library, [1, 2, 3]);

    await act(async () => profile().favoriteActions.reorder([3, 1, 2]));
    await waitFor(() => expect(profile().favorites.map((g) => g.id)).toEqual([3, 1, 2]));

    await act(async () => profile().favoriteActions.remove({ id: 1, name: 'Castlevania' }));
    await waitFor(() => expect(profile().favorites.map((g) => g.id)).toEqual([3, 2]));
    expect(jest.mocked(saveFavoriteGames).mock.calls.map(([ids]) => ids)).toEqual([
      [3, 1, 2],
      [3, 2],
    ]);
  });

  it('drop a pick that was hidden since from what is saved next', async () => {
    jest.mocked(saveFavoriteGames).mockClear();
    // Game 5 is hidden: it's saved as a pick but isn't shown.
    const profile = live(library, [5, 1]);
    expect(profile().favoritePicker.pickedIds).toEqual([1]);

    await act(async () => {
      profile().favoritePicker.onToggle(2);
    });
    expect(saveFavoriteGames).toHaveBeenCalledWith([1, 2]);
  });

  it('are none again when every pick has been hidden or removed', () => {
    expect(open(library, null, [5, 99]).favorites).toEqual([]);
  });
});

it('leaves out a platform whose games are all hidden', () => {
  const profile = open([
    game({ id: 1 }),
    game({ id: 2, source: 'manual', platform: 'N64', status: 'hidden' }),
  ]);
  expect(profile.platforms).toEqual([{ name: 'PC', count: 1 }]);
});

it('is an empty profile, not an error, for an empty library', () => {
  expect(open([])).toMatchObject({
    loading: false,
    loadError: false,
    figures: { games: 0, finished: 0, finishedThisYear: 0, hours: 0 },
    favorites: [],
    activity: [],
    platforms: [],
  });
});

it('lists where the library is played by the games it counts, most first, then by name', () => {
  session = steamPlayer;
  const profile = open([
    // PC has the most games, but nearly all are hidden Steam tools.
    ...Array.from({ length: 5 }, (_, i) => game({ id: 10 + i, status: 'hidden' })),
    game({ id: 1 }),
    game({ id: 2, source: 'manual', platform: 'Switch' }),
    game({ id: 3, source: 'manual', platform: 'Switch' }),
    game({ id: 4, source: 'manual', platform: 'GBA' }),
  ]);
  expect(profile.platforms).toEqual([
    { name: 'Switch', count: 2 },
    { name: 'GBA', count: 1 },
    { name: 'PC', count: 1 },
  ]);
});

describe('the favorites, before they are known', () => {
  it('are loading, then ready once they arrive', () => {
    session = steamPlayer;
    expect(open([game({ id: 1 })]).favoritesState).toBe('ready');
  });

  it("are loading while only the library has arrived, so the row isn't drawn empty", () => {
    session = steamPlayer;
    const client = new QueryClient();
    client.setQueryData(queryKeys.games.list('user-1'), [game({ id: 1 })]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const profile = renderHook(() => useProfilePage(), { wrapper }).result.current;
    expect(profile.favoritesState).toBe('loading');
  });
});

describe('the name and picture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    session = steamPlayer;
  });

  it("are the player's own when chosen, with Steam's to go back to", () => {
    session = {
      ...steamPlayer,
      profile: {
        ...steamPlayer.profile,
        display_name: 'Big Boss',
        avatar_url: 'https://x/storage/v1/object/public/avatars/u/a.webp',
      },
    };
    const profile = open([]);
    expect(profile.name).toBe('Big Boss');
    expect(profile.avatar).toBe('https://x/storage/v1/object/public/avatars/u/a.webp');
    expect(profile.identity).toMatchObject({
      chosenName: 'Big Boss',
      accountName: 'Ankrath',
      hasOwnPicture: true,
    });
  });

  it('saves a new name and shows it everywhere at once', async () => {
    jest.mocked(saveProfileName).mockResolvedValue({ ok: true, name: 'Big Boss' });
    const result = await open([]).identity.rename('Big Boss');
    expect(result.ok).toBe(true);
    expect(mockUpdateProfile).toHaveBeenCalledWith({ display_name: 'Big Boss' });
  });

  it('leaves a failed rename to the field to report, once', async () => {
    jest
      .mocked(saveProfileName)
      .mockResolvedValue({ ok: false, error: "Couldn't save your name. Please try again." });
    const result = await open([]).identity.rename('Big Boss');
    expect(result).toEqual({ ok: false, error: "Couldn't save your name. Please try again." });
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shrinks a picture, uploads it and shows it', async () => {
    const square = new Blob(['x'], { type: 'image/webp' });
    jest.mocked(squareAvatar).mockResolvedValue(square);
    jest.mocked(uploadAvatar).mockResolvedValue({ ok: true, avatarUrl: 'https://x/new.webp' });
    const file = new File(['big'], 'me.jpg', { type: 'image/jpeg' });

    expect((await open([]).identity.uploadPicture(file)).ok).toBe(true);
    expect(squareAvatar).toHaveBeenCalledWith(file);
    expect(uploadAvatar).toHaveBeenCalledWith(square);
    expect(mockUpdateProfile).toHaveBeenCalledWith({ avatar_url: 'https://x/new.webp' });
  });

  it('says so when a picture cannot be read, without uploading anything', async () => {
    jest.mocked(squareAvatar).mockResolvedValue(null);
    const result = await open([]).identity.uploadPicture(new File(['?'], 'x.heic'));
    expect(result.ok).toBe(false);
    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Couldn't read that picture. Try a JPEG or PNG.");
  });

  it('says why an upload or a removal failed, since the picture has no field to say it in', async () => {
    jest.mocked(squareAvatar).mockResolvedValue(new Blob(['x']));
    jest.mocked(uploadAvatar).mockResolvedValue({ ok: false, error: 'That picture is too large' });
    await open([]).identity.uploadPicture(new File(['x'], 'x.png'));
    expect(toast.error).toHaveBeenCalledWith('That picture is too large');

    jest.mocked(removeAvatar).mockResolvedValue({ ok: true, avatarUrl: null });
    await open([]).identity.removePicture();
    expect(mockUpdateProfile).toHaveBeenLastCalledWith({ avatar_url: null });
  });
});

describe('the account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    session = steamPlayer;
  });

  it('counts the Steam games disconnecting would remove: not the ones moved to a console', () => {
    const profile = open([
      game({ id: 1 }),
      game({ id: 2 }),
      game({ id: 3, platform: 'Switch' }),
      game({ id: 4, source: 'manual', platform: 'PS5' }),
    ]);
    expect(profile.account.steamGames).toBe(2);
  });

  it('reloads the page once Steam is disconnected, and not when it fails', async () => {
    jest.mocked(disconnectSteam).mockResolvedValueOnce({ ok: false, error: 'nope' });
    await open([]).account.disconnectSteam();
    expect(mockReload).not.toHaveBeenCalled();

    jest.mocked(disconnectSteam).mockResolvedValueOnce({ ok: true });
    await open([]).account.disconnectSteam();
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('asks for an email change with the password', async () => {
    jest.mocked(changeEmail).mockResolvedValue({
      ok: true,
      email: 'player@example.com',
      pendingEmail: 'new@example.com',
    });
    const result = await open([]).account.changeEmail('new@example.com', 'My-pass1');
    expect(changeEmail).toHaveBeenCalledWith('new@example.com', 'My-pass1');
    expect(result.ok).toBe(true);
  });
});
