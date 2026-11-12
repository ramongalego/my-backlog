/**
 * @jest-environment node
 */
import { GET } from '@/app/api/carousels/route';
import { loadCarouselPools } from '@/lib/data/loaders';

let user: { id: string } | null = { id: 'user-1' };

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/data/loaders', () => ({ loadCarouselPools: jest.fn() }));

beforeEach(() => {
  user = { id: 'user-1' };
  jest.mocked(loadCarouselPools).mockReset();
});

it('refuses a signed-out request, without reading anything', async () => {
  user = null;
  expect((await GET()).status).toBe(401);
  expect(loadCarouselPools).not.toHaveBeenCalled();
});

it("returns the signed-in player's rows, never to be shared from a cache", async () => {
  const pools = { shortGames: [{ id: 1, name: 'Celeste' }], moreLike: null };
  jest.mocked(loadCarouselPools).mockResolvedValue(pools as never);

  const res = await GET();

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(pools);
  expect(loadCarouselPools).toHaveBeenCalledWith(expect.anything(), 'user-1');
  expect(res.headers.get('Cache-Control')).toBe('private, no-cache');
});

it("says so when the rows couldn't be built", async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(loadCarouselPools).mockRejectedValue(new Error('db down'));

  const res = await GET();

  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: 'Failed to load carousels' });
});
