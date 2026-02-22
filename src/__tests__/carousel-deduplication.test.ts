import type { GameWithImage } from '@/types/games';

// Extract the deduplication logic for testing
function deduplicateHighlyRatedGames(
  highlyRatedPool: GameWithImage[],
  shortGames: GameWithImage[],
  weekendGames: GameWithImage[],
): GameWithImage[] {
  const excludedAppIds = new Set([
    ...shortGames.map((g) => g.app_id),
    ...weekendGames.map((g) => g.app_id),
  ]);
  return highlyRatedPool.filter((g) => !excludedAppIds.has(g.app_id)).slice(0, 10);
}

describe('carousel deduplication', () => {
  const createGame = (id: number, name: string): GameWithImage => ({
    app_id: id,
    name,
    header_image: `https://example.com/${id}.jpg`,
    main_story_hours: 10,
    playtime_forever: 0,
  });

  describe('deduplicateHighlyRatedGames', () => {
    it('should remove games that appear in short games carousel', () => {
      const highlyRated = [createGame(1, 'Game 1'), createGame(2, 'Game 2')];
      const shortGames = [createGame(1, 'Game 1')];
      const weekendGames: GameWithImage[] = [];

      const result = deduplicateHighlyRatedGames(highlyRated, shortGames, weekendGames);

      expect(result).toHaveLength(1);
      expect(result[0].app_id).toBe(2);
    });

    it('should remove games that appear in weekend games carousel', () => {
      const highlyRated = [createGame(1, 'Game 1'), createGame(2, 'Game 2')];
      const shortGames: GameWithImage[] = [];
      const weekendGames = [createGame(2, 'Game 2')];

      const result = deduplicateHighlyRatedGames(highlyRated, shortGames, weekendGames);

      expect(result).toHaveLength(1);
      expect(result[0].app_id).toBe(1);
    });

    it('should remove games that appear in both carousels', () => {
      const highlyRated = [
        createGame(1, 'Game 1'),
        createGame(2, 'Game 2'),
        createGame(3, 'Game 3'),
      ];
      const shortGames = [createGame(1, 'Game 1')];
      const weekendGames = [createGame(2, 'Game 2')];

      const result = deduplicateHighlyRatedGames(highlyRated, shortGames, weekendGames);

      expect(result).toHaveLength(1);
      expect(result[0].app_id).toBe(3);
    });

    it('should keep all games when no overlap', () => {
      const highlyRated = [createGame(1, 'Game 1'), createGame(2, 'Game 2')];
      const shortGames = [createGame(3, 'Game 3')];
      const weekendGames = [createGame(4, 'Game 4')];

      const result = deduplicateHighlyRatedGames(highlyRated, shortGames, weekendGames);

      expect(result).toHaveLength(2);
    });

    it('should limit to 10 games after deduplication', () => {
      const highlyRated = Array.from({ length: 15 }, (_, i) => createGame(i + 1, `Game ${i + 1}`));
      const shortGames: GameWithImage[] = [];
      const weekendGames: GameWithImage[] = [];

      const result = deduplicateHighlyRatedGames(highlyRated, shortGames, weekendGames);

      expect(result).toHaveLength(10);
    });

    it('should return empty array when all games are duplicates', () => {
      const highlyRated = [createGame(1, 'Game 1'), createGame(2, 'Game 2')];
      const shortGames = [createGame(1, 'Game 1')];
      const weekendGames = [createGame(2, 'Game 2')];

      const result = deduplicateHighlyRatedGames(highlyRated, shortGames, weekendGames);

      expect(result).toHaveLength(0);
    });

    it('should handle empty highly rated pool', () => {
      const highlyRated: GameWithImage[] = [];
      const shortGames = [createGame(1, 'Game 1')];
      const weekendGames = [createGame(2, 'Game 2')];

      const result = deduplicateHighlyRatedGames(highlyRated, shortGames, weekendGames);

      expect(result).toHaveLength(0);
    });

    it('should preserve order after deduplication', () => {
      const highlyRated = [
        createGame(1, 'Game 1'),
        createGame(2, 'Game 2'),
        createGame(3, 'Game 3'),
        createGame(4, 'Game 4'),
      ];
      const shortGames = [createGame(2, 'Game 2')];
      const weekendGames: GameWithImage[] = [];

      const result = deduplicateHighlyRatedGames(highlyRated, shortGames, weekendGames);

      expect(result.map((g) => g.app_id)).toEqual([1, 3, 4]);
    });
  });
});
