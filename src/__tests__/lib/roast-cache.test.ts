import { getCachedRoast, setCachedRoast, type RoastResponse } from '@/lib/roast/cache';

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
  it('should return null for uncached steam ID', () => {
    expect(getCachedRoast('nonexistent-id')).toBeNull();
  });

  it('should return cached roast after setting it', () => {
    const id = `test-${Date.now()}`;
    setCachedRoast(id, mockRoast);

    const result = getCachedRoast(id);

    expect(result).toEqual(mockRoast);
  });

  it('should return the correct roast for each steam ID', () => {
    const id1 = `user-a-${Date.now()}`;
    const id2 = `user-b-${Date.now()}`;
    const roast2 = { ...mockRoast, roast: 'Different roast', steamId: id2 };

    setCachedRoast(id1, mockRoast);
    setCachedRoast(id2, roast2);

    expect(getCachedRoast(id1)?.roast).toBe('You have 500 games and played 3 of them.');
    expect(getCachedRoast(id2)?.roast).toBe('Different roast');
  });

  it('should overwrite existing cache entry', () => {
    const id = `overwrite-${Date.now()}`;
    setCachedRoast(id, mockRoast);

    const updated = { ...mockRoast, roast: 'Updated roast' };
    setCachedRoast(id, updated);

    expect(getCachedRoast(id)?.roast).toBe('Updated roast');
  });
});
