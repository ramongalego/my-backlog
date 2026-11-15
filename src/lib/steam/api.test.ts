/**
 * @jest-environment node
 */
import { getOwnedGames } from '@/lib/steam/api';

const originalFetch = global.fetch;
afterAll(() => {
  global.fetch = originalFetch;
});

/** Steam answering GetOwnedGames with `response`. */
function steamAnswers(response: unknown, status = 200) {
  global.fetch = jest.fn(
    async () => new Response(JSON.stringify({ response }), { status }),
  ) as typeof fetch;
}

const PORTAL = { appid: 620, name: 'Portal 2', playtime_forever: 480, img_icon_url: 'abc' };

it("returns the player's games", async () => {
  steamAnswers({ game_count: 1, games: [PORTAL] });
  await expect(getOwnedGames('7656', 'key')).resolves.toEqual({
    games: [PORTAL],
    isPrivate: false,
  });
});

it('tells private game details (no library at all) from a library with nothing in it', async () => {
  // Game details private: Steam sends an empty answer.
  steamAnswers({});
  await expect(getOwnedGames('7656', 'key')).resolves.toEqual({ games: [], isPrivate: true });

  // Public, and the account owns nothing: a count of 0.
  steamAnswers({ game_count: 0 });
  await expect(getOwnedGames('7656', 'key')).resolves.toEqual({ games: [], isPrivate: false });
});

it('drops a malformed game without calling the library private', async () => {
  steamAnswers({ game_count: 2, games: [PORTAL, { name: 'No id' }] });
  await expect(getOwnedGames('7656', 'key')).resolves.toEqual({
    games: [PORTAL],
    isPrivate: false,
  });
});

it('throws when Steam refuses, which is not the same as private', async () => {
  steamAnswers({}, 503);
  await expect(getOwnedGames('7656', 'key')).rejects.toThrow('Steam API error: 503');
});
