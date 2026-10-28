/**
 * @jest-environment node
 */
import { getCachedRoast, setCachedRoast } from '@/lib/roast/cache';
import type { RoastResponse } from '@/types/roast';

const mockRoast: RoastResponse = {
  roast: 'You have 500 games and played 3 of them.',
  steamId: '76561198000000001',
  profile: {
    name: 'TestUser',
    avatar: 'https://example.com/avatar.jpg',
    profileUrl: 'https://steamcommunity.com/id/testuser',
  },
  stats: {
    totalGames: 500,
    totalHours: 10,
    neverPlayed: 490,
  },
};

describe('roast cache', () => {
  it('should return null for uncached steam ID', async () => {
    expect(await getCachedRoast('nonexistent-id')).toBeNull();
  });

  it('should return cached roast after setting it', async () => {
    const id = `test-${Date.now()}`;
    await setCachedRoast(id, mockRoast);

    const result = await getCachedRoast(id);

    expect(result).toEqual(mockRoast);
  });

  it('should return the correct roast for each steam ID', async () => {
    const id1 = `user-a-${Date.now()}`;
    const id2 = `user-b-${Date.now()}`;
    const roast2 = { ...mockRoast, roast: 'Different roast', steamId: id2 };

    await setCachedRoast(id1, mockRoast);
    await setCachedRoast(id2, roast2);

    expect((await getCachedRoast(id1))?.roast).toBe('You have 500 games and played 3 of them.');
    expect((await getCachedRoast(id2))?.roast).toBe('Different roast');
  });

  it('should overwrite existing cache entry', async () => {
    const id = `overwrite-${Date.now()}`;
    await setCachedRoast(id, mockRoast);

    const updated = { ...mockRoast, roast: 'Updated roast' };
    await setCachedRoast(id, updated);

    expect((await getCachedRoast(id))?.roast).toBe('Updated roast');
  });
});
