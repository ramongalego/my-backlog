import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSettingsPage } from '@/hooks/useSettingsPage';
import type { GameItem } from '@/lib/data/loaders';
import { libraryGame as game } from '@/lib/account/test-games';
import { queryKeys } from '@/lib/query-keys';
import { changeEmail, disconnectSteam } from '@/lib/client/account';
import { toast } from 'sonner';
import {
  removeAvatar,
  saveProfileName,
  saveProfilePrivacy,
  saveUsername,
  squareAvatar,
  uploadAvatar,
} from '@/lib/client/profile-identity';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

let session: {
  user: { id: string; email?: string; new_email?: string; created_at?: string } | null;
  profile: {
    steam_id: string | null;
    steam_username: string | null;
    steam_avatar?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    username: string;
    is_private?: boolean | null;
  } | null;
};
const mockUpdateProfile = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => session,
  useUpdateSessionProfile: () => mockUpdateProfile,
}));
jest.mock('sonner', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('@/lib/client/profile-identity', () => ({
  saveUsername: jest.fn(),
  saveProfileName: jest.fn(),
  saveProfilePrivacy: jest.fn(),
  uploadAvatar: jest.fn(),
  removeAvatar: jest.fn(),
  squareAvatar: jest.fn(),
}));
jest.mock('@/lib/client/account', () => ({
  changePassword: jest.fn(),
  changeEmail: jest.fn(),
  deleteAccount: jest.fn(),
  disconnectSteam: jest.fn(),
  downloadData: jest.fn(),
  sendPasswordReset: jest.fn(),
}));
const mockReload = jest.fn();
jest.mock('@/lib/reload', () => ({ reloadAtTop: () => mockReload() }));

const steamPlayer = {
  user: { id: 'user-1', email: 'player@example.com' },
  profile: { steam_id: '7656', steam_username: 'Ankrath', username: 'ankrath' },
};

/**
 * Settings for a library; `games` undefined leaves the library not known yet.
 * `counted` is the game count the header already has.
 */
function open(games?: GameItem[], counted?: number, hasPassword?: boolean) {
  const client = new QueryClient();
  if (games) client.setQueryData(queryKeys.games.list('user-1'), games);
  if (counted !== undefined) {
    client.setQueryData(queryKeys.library.meta('user-1'), { gameCount: counted });
  }
  if (hasPassword !== undefined) {
    client.setQueryData(queryKeys.auth.hasPassword('user-1'), hasPassword);
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSettingsPage(), { wrapper }).result.current;
}

beforeEach(() => {
  jest.clearAllMocks();
  session = steamPlayer;
});

it('is the account as the session has it, without waiting for the library', () => {
  expect(open()).toMatchObject({
    username: 'ankrath',
    email: 'player@example.com',
    pendingEmail: null,
    steam: { username: 'Ankrath' },
  });
});

it('has no Steam account to show for one that never connected, and says a new email is waiting', () => {
  session = {
    user: { ...steamPlayer.user, new_email: 'new@example.com' },
    profile: { steam_id: null, steam_username: null, username: 'player4821' },
  };
  expect(open([])).toMatchObject({ steam: null, pendingEmail: 'new@example.com' });
});

it('says when the account was made, by its month', () => {
  expect(open().memberSince).toBeNull();
  session = { ...steamPlayer, user: { ...steamPlayer.user, created_at: '2026-01-18T10:00:00Z' } };
  expect(open().memberSince).toBe('January 2026');
});

it('says whether the account has a password once the database has', () => {
  expect(open([], 0, false).signIn.hasPassword).toBe(false);
  expect(open([], 0, true).signIn.hasPassword).toBe(true);
});

it('offers a copy of the data only when there are games to put in it', () => {
  expect(open([]).downloadData).toBeUndefined();
  expect(open([game({ id: 1 })]).downloadData).toEqual(expect.any(Function));
});

it("goes by the header's count until the library arrives, so the row doesn't come and go", () => {
  expect(open(undefined, 12).downloadData).toEqual(expect.any(Function));
  expect(open(undefined, 0).downloadData).toBeUndefined();
  expect(open(undefined).downloadData).toBeUndefined();
  // The library itself has the last word: a count of none, but hidden games to export.
  expect(open([game({ id: 1, status: 'hidden' })], 0).downloadData).toEqual(expect.any(Function));
});

it('counts the Steam games disconnecting would remove: not the ones moved to a console', () => {
  const settings = open([
    game({ id: 1 }),
    game({ id: 2 }),
    game({ id: 3, platform: 'Switch' }),
    game({ id: 4, source: 'manual', platform: 'PS5' }),
  ]);
  expect(settings.steamGames).toBe(2);
});

it("doesn't say there are none to remove while the library isn't known", () => {
  expect(open().steamGames).toBeNull();
  expect(open([]).steamGames).toBe(0);
});

it('reloads the page once Steam is disconnected, and not when it fails', async () => {
  jest.mocked(disconnectSteam).mockResolvedValueOnce({ ok: false, error: 'nope' });
  await open([]).disconnectSteam();
  expect(mockReload).not.toHaveBeenCalled();

  jest.mocked(disconnectSteam).mockResolvedValueOnce({ ok: true });
  await open([]).disconnectSteam();
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('asks for an email change with the password', async () => {
  jest.mocked(changeEmail).mockResolvedValue({
    ok: true,
    email: 'player@example.com',
    pendingEmail: 'new@example.com',
  });
  const result = await open([]).changeEmail('new@example.com', 'My-pass1');
  expect(changeEmail).toHaveBeenCalledWith('new@example.com', 'My-pass1');
  expect(result.ok).toBe(true);
});

it('saves a new username and shows it everywhere at once', async () => {
  jest.mocked(saveUsername).mockResolvedValue({ ok: true, username: 'mistkai' });
  expect(await open([]).changeUsername('mistkai')).toEqual({ ok: true, username: 'mistkai' });
  expect(saveUsername).toHaveBeenCalledWith('mistkai');
  expect(mockUpdateProfile).toHaveBeenCalledWith({ username: 'mistkai' });
});

it('leaves a refused username to the dialog to report, and the session as it was', async () => {
  const refused = {
    ok: false as const,
    error: 'That username is taken',
    field: 'username' as const,
  };
  jest.mocked(saveUsername).mockResolvedValue(refused);
  expect(await open([]).changeUsername('mistkai')).toEqual(refused);
  expect(mockUpdateProfile).not.toHaveBeenCalled();
});

describe('the profile', () => {
  it("is the name and picture the account has: Steam's until the player chooses their own", () => {
    session = {
      ...steamPlayer,
      profile: { ...steamPlayer.profile, steam_avatar: 'https://avatars.steamstatic.com/a.jpg' },
    };
    expect(open().profile).toMatchObject({
      name: 'Ankrath',
      chosenName: null,
      accountName: 'Ankrath',
      avatar: 'https://avatars.steamstatic.com/a.jpg',
      hasOwnPicture: false,
    });

    session = {
      ...steamPlayer,
      profile: {
        ...steamPlayer.profile,
        display_name: 'Big Boss',
        avatar_url: 'https://x/storage/v1/object/public/avatars/u/a.webp',
      },
    };
    expect(open().profile).toMatchObject({
      name: 'Big Boss',
      chosenName: 'Big Boss',
      accountName: 'Ankrath',
      avatar: 'https://x/storage/v1/object/public/avatars/u/a.webp',
      hasOwnPicture: true,
    });
  });

  it('saves a new name and shows it everywhere at once', async () => {
    jest.mocked(saveProfileName).mockResolvedValue({ ok: true, name: 'Big Boss' });
    const result = await open().profile.rename('Big Boss');
    expect(result.ok).toBe(true);
    expect(mockUpdateProfile).toHaveBeenCalledWith({ display_name: 'Big Boss' });
  });

  it('leaves a failed rename to the field to report, once', async () => {
    jest
      .mocked(saveProfileName)
      .mockResolvedValue({ ok: false, error: "That name isn't available" });
    const result = await open().profile.rename('Admin');
    expect(result).toEqual({ ok: false, error: "That name isn't available" });
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shrinks a picture, uploads it and shows it', async () => {
    const square = new Blob(['x'], { type: 'image/webp' });
    jest.mocked(squareAvatar).mockResolvedValue(square);
    jest.mocked(uploadAvatar).mockResolvedValue({ ok: true, avatarUrl: 'https://x/new.webp' });
    const file = new File(['big'], 'me.jpg', { type: 'image/jpeg' });

    expect((await open().profile.uploadPicture(file)).ok).toBe(true);
    expect(squareAvatar).toHaveBeenCalledWith(file);
    expect(uploadAvatar).toHaveBeenCalledWith(square);
    expect(mockUpdateProfile).toHaveBeenCalledWith({ avatar_url: 'https://x/new.webp' });
  });

  it('says so when a picture cannot be read, without uploading anything', async () => {
    jest.mocked(squareAvatar).mockResolvedValue(null);
    const result = await open().profile.uploadPicture(new File(['?'], 'x.heic'));
    expect(result.ok).toBe(false);
    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Couldn't read that picture. Try a JPEG or PNG.");
  });

  it('says why an upload or a removal failed, since the picture has no field to say it in', async () => {
    jest.mocked(squareAvatar).mockResolvedValue(new Blob(['x']));
    jest.mocked(uploadAvatar).mockResolvedValue({ ok: false, error: 'That picture is too large' });
    await open().profile.uploadPicture(new File(['x'], 'x.png'));
    expect(toast.error).toHaveBeenCalledWith('That picture is too large');
    expect(mockUpdateProfile).not.toHaveBeenCalled();

    jest
      .mocked(removeAvatar)
      .mockResolvedValue({ ok: false, error: "Couldn't remove your avatar. Please try again." });
    await open().profile.removePicture();
    expect(toast.error).toHaveBeenLastCalledWith("Couldn't remove your avatar. Please try again.");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("takes the player's picture off, back to the account's", async () => {
    jest.mocked(removeAvatar).mockResolvedValue({ ok: true, avatarUrl: null });
    await open().profile.removePicture();
    expect(mockUpdateProfile).toHaveBeenCalledWith({ avatar_url: null });
  });
});

describe('who can see the profile', () => {
  it('is not known until the profile is read, then as the profile says', () => {
    expect(open().profile.isPrivate).toBeNull();
    session = { ...steamPlayer, profile: { ...steamPlayer.profile, is_private: false } };
    expect(open().profile.isPrivate).toBe(false);
    session = { ...steamPlayer, profile: { ...steamPlayer.profile, is_private: true } };
    expect(open().profile.isPrivate).toBe(true);
  });

  it('shows the change at once and saves it', async () => {
    jest.mocked(saveProfilePrivacy).mockResolvedValue({ ok: true, private: true });
    const { setPrivate } = open().profile;
    await act(() => setPrivate(true));
    expect(saveProfilePrivacy).toHaveBeenCalledWith(true);
    expect(mockUpdateProfile.mock.calls).toEqual([[{ is_private: true }]]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('puts it back and says so when it could not be saved', async () => {
    jest
      .mocked(saveProfilePrivacy)
      .mockResolvedValue({ ok: false, error: "Couldn't save that. Please try again." });
    const { setPrivate } = open().profile;
    await act(() => setPrivate(true));
    expect(mockUpdateProfile.mock.calls).toEqual([[{ is_private: true }], [{ is_private: false }]]);
    expect(toast.error).toHaveBeenCalledWith("Couldn't save that. Please try again.");
  });

  it('sends one change at a time, and can be changed again once it settles', async () => {
    let done!: (result: { ok: true; private: boolean }) => void;
    jest
      .mocked(saveProfilePrivacy)
      .mockReturnValueOnce(new Promise((resolve) => (done = resolve)))
      .mockResolvedValue({ ok: true, private: false });
    const { setPrivate } = open().profile;
    let first!: Promise<void>;
    await act(async () => {
      first = setPrivate(true);
      void setPrivate(false);
      void setPrivate(true);
    });
    expect(saveProfilePrivacy).toHaveBeenCalledTimes(1);
    // The presses that were dropped changed nothing on the page either.
    expect(mockUpdateProfile.mock.calls).toEqual([[{ is_private: true }]]);

    await act(async () => {
      done({ ok: true, private: true });
      await first;
    });
    await act(() => setPrivate(false));
    expect(saveProfilePrivacy).toHaveBeenCalledTimes(2);
    expect(saveProfilePrivacy).toHaveBeenLastCalledWith(false);
  });
});
