import { steamStoreUrl } from '@/lib/games/store-link';

describe('steamStoreUrl', () => {
  it('links a game you play on Steam to its store page', () => {
    expect(steamStoreUrl({ app_id: 2369900, source: 'steam', platform: 'PC' })).toBe(
      'https://store.steampowered.com/app/2369900/',
    );
  });

  it("doesn't link a Steam game you moved to a console", () => {
    expect(steamStoreUrl({ app_id: 2369900, source: 'steam', platform: 'Switch' })).toBeNull();
    // Cards pass only the console they show.
    expect(steamStoreUrl({ app_id: 2369900, platform: 'Switch' })).toBeNull();
  });

  it("doesn't link a game without a Steam library id", () => {
    expect(steamStoreUrl({ app_id: null, source: 'manual', platform: 'PS5' })).toBeNull();
  });
});
