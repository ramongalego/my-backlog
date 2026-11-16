import { removeAvatar, saveProfileName, uploadAvatar } from '@/lib/client/profile-identity';
import { saveFavoriteGames } from '@/lib/client/favorites';

const answer = (status: number, body: unknown) =>
  (global.fetch = jest.fn(
    async () => ({ ok: status < 300, status, json: async () => body }) as unknown as Response,
  ));
const offline = () =>
  (global.fetch = jest.fn(async () => {
    throw new TypeError('Failed to fetch');
  }));
const OFFLINE = "Couldn't reach MyBacklog. Check your connection and try again.";

describe('saveProfileName', () => {
  it('saves the name, or clears it with null', async () => {
    answer(200, { name: 'Big Boss' });
    expect(await saveProfileName('Big Boss')).toEqual({ ok: true, name: 'Big Boss' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/profile/name',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'Big Boss' }) }),
    );

    answer(200, { name: null });
    expect(await saveProfileName(null)).toEqual({ ok: true, name: null });
  });

  it("gives back the server's reason, or its own words when there is none", async () => {
    answer(400, { error: 'Keep it to 40 characters' });
    expect(await saveProfileName('x'.repeat(41))).toEqual({
      ok: false,
      error: 'Keep it to 40 characters',
    });

    answer(500, null);
    expect(await saveProfileName('Snake')).toEqual({
      ok: false,
      error: "Couldn't save your name. Please try again.",
    });
  });

  it('says to try later when the app limits it, and says so when offline', async () => {
    answer(429, { error: 'Too many requests' });
    expect(await saveProfileName('Snake')).toEqual({
      ok: false,
      error: 'Too many changes in a row. Try again later.',
    });

    offline();
    expect(await saveProfileName('Snake')).toEqual({ ok: false, error: OFFLINE });
  });
});

describe('uploadAvatar and removeAvatar', () => {
  it('sends the picture as the form field the server reads', async () => {
    answer(200, { avatarUrl: 'https://x/storage/v1/object/public/avatars/u/a.webp' });
    const picture = new Blob(['x'], { type: 'image/webp' });
    expect(await uploadAvatar(picture)).toEqual({
      ok: true,
      avatarUrl: 'https://x/storage/v1/object/public/avatars/u/a.webp',
    });
    const [url, init] = jest.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('/api/profile/avatar');
    expect(init?.method).toBe('POST');
    expect((init?.body as FormData).get('file')).toBeInstanceOf(Blob);
  });

  it('takes the picture off', async () => {
    answer(200, { avatarUrl: null });
    expect(await removeAvatar()).toEqual({ ok: true, avatarUrl: null });
    expect(global.fetch).toHaveBeenCalledWith('/api/profile/avatar', { method: 'DELETE' });
  });

  it('says why a picture was refused', async () => {
    answer(413, { error: 'That picture is too large' });
    expect(await uploadAvatar(new Blob(['x']))).toEqual({
      ok: false,
      error: 'That picture is too large',
    });
  });
});

describe('saveFavoriteGames', () => {
  it('saves the picks, in order', async () => {
    answer(200, { gameIds: [3, 1] });
    await expect(saveFavoriteGames([3, 1])).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/profile/favorites',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ gameIds: [3, 1] }) }),
    );
  });

  it("throws the server's reason, which the page shows as it puts the row back", async () => {
    answer(400, { error: 'One of those games is no longer in your library' });
    await expect(saveFavoriteGames([9])).rejects.toThrow(
      'One of those games is no longer in your library',
    );
  });

  it("throws words for the player when offline or limited, not the browser's own", async () => {
    offline();
    await expect(saveFavoriteGames([1])).rejects.toThrow(OFFLINE);

    answer(429, { error: 'Too many requests' });
    await expect(saveFavoriteGames([1])).rejects.toThrow(
      'Too many changes in a row. Try again in a minute.',
    );
  });
});
