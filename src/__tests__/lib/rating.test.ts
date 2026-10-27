import { criticScoreOf, ratingOf } from '@/lib/games/rating';

describe('ratingOf', () => {
  it('is the critic score when 3 or more critics reviewed the game', () => {
    expect(ratingOf({ critic_score: 88, critic_count: 3, steam_review_weighted: 95 })).toBe(88);
    expect(criticScoreOf({ critic_score: 88, critic_count: 3 })).toBe(88);
  });

  it("falls back to Steam's weighted score with fewer critics or none", () => {
    expect(ratingOf({ critic_score: 100, critic_count: 1, steam_review_weighted: 77 })).toBe(77);
    expect(ratingOf({ critic_score: null, critic_count: null, steam_review_weighted: 77 })).toBe(
      77,
    );
    expect(criticScoreOf({ critic_score: 100, critic_count: 1 })).toBeNull();
  });

  it('is null for a game nobody rated', () => {
    expect(ratingOf({})).toBeNull();
  });
});
