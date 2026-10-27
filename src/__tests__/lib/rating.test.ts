import {
  criticScoreOf,
  ratingOf,
  steamOnCriticScale,
  weightedSteamScore,
} from '@/lib/games/rating';

// Games from a real library, as the database has them.
const bg3 = {
  critic_score: 95,
  critic_count: 10,
  steam_review_score: 96,
  steam_review_count: 759332,
};
const hades = {
  critic_score: 94,
  critic_count: 17,
  steam_review_score: 97,
  steam_review_count: 287359,
};
const ffxvi = {
  critic_score: 92,
  critic_count: 9,
  steam_review_score: 78,
  steam_review_count: 24538,
};
// Steam only (their critic scores are from fewer than 3 reviews, if any).
const doki = { steam_review_score: 96, steam_review_count: 220000 };
const portal = {
  critic_score: 80,
  critic_count: 1,
  steam_review_score: 98,
  steam_review_count: 175004,
};
const ofdp = { steam_review_score: 98, steam_review_count: 12555 };
// Critics only: not on Steam.
const threeHouses = { critic_score: 93, critic_count: 9 };

describe('ratingOf', () => {
  it('counts critics only from 3 reviews', () => {
    expect(criticScoreOf({ critic_score: 88, critic_count: 3 })).toBe(88);
    expect(criticScoreOf(portal)).toBeNull();
  });

  it('averages the critic score and Steam reviews (on the critic scale) when there are both', () => {
    // Critics 92, players 78% (about 74 on the critic scale).
    expect(ratingOf(ffxvi)).toBeCloseTo(82.8, 1);
    // A game critics loved and players less so ranks below one both loved.
    expect(ratingOf(ffxvi)!).toBeLessThan(ratingOf(hades)!);
  });

  it('estimates a game rated by one side only, three-quarters of the way from the average', () => {
    // 93 is 12 above the average of 81, so 81 + 9.
    expect(ratingOf(threeHouses)).toBe(90);
  });

  it('ranks a game both sides love above one that only one side rated, however highly', () => {
    for (const game of [doki, portal, ofdp, threeHouses]) {
      expect(ratingOf(game)!).toBeLessThan(ratingOf(bg3)!);
    }
  });

  it('rewards how many people liked a game, not only how many of them did', () => {
    // 98% of 12,555 ranks below 96% of 220,000.
    expect(ratingOf(ofdp)!).toBeLessThan(ratingOf(doki)!);
  });

  it('is null for a game nobody rated', () => {
    expect(ratingOf({})).toBeNull();
    expect(ratingOf({ steam_review_score: 90, steam_review_count: 0 })).toBeNull();
  });
});

describe('weightedSteamScore', () => {
  it('trusts a score more the more reviews it has', () => {
    expect(weightedSteamScore(98, 12555)).toBeCloseTo(94.2, 1);
    expect(weightedSteamScore(96, 220000)).toBeCloseTo(95.8, 1);
    // A few hundred reviews read close to the average of 70.
    expect(weightedSteamScore(95, 500)).toBe(75);
  });
});

describe('steamOnCriticScale', () => {
  it('converts Steam percentages to the critic scale, in between the points too', () => {
    expect(steamOnCriticScale(98)).toBe(94);
    expect(steamOnCriticScale(90)).toBe(82);
    expect(steamOnCriticScale(91)).toBe(82.5);
    expect(steamOnCriticScale(100)).toBe(96);
    expect(steamOnCriticScale(0)).toBe(0);
  });

  it('keeps the order: a higher Steam score never converts lower', () => {
    for (let s = 1; s <= 100; s++) {
      expect(steamOnCriticScale(s)).toBeGreaterThanOrEqual(steamOnCriticScale(s - 1));
    }
  });
});
