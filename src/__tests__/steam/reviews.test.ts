import { steamReviewLabel, steamReviewTitle } from '@/lib/steam/review-label';
import { reviewsChanged } from '@/lib/steam/reviews';

describe('steamReviewLabel', () => {
  it.each([
    [98, 392259, 'Overwhelmingly Positive'],
    [97, 400, 'Very Positive'], // 95%+ needs 500 reviews to be "Overwhelmingly"
    [92, 10540, 'Very Positive'],
    [85, 30, 'Positive'],
    [75, 26487, 'Mostly Positive'],
    [55, 1000, 'Mixed'],
    [30, 1000, 'Mostly Negative'],
    [10, 800, 'Overwhelmingly Negative'],
    [10, 100, 'Very Negative'],
    [10, 20, 'Negative'],
  ])('%i%% of %i reviews is %s', (pct, count, label) => {
    expect(steamReviewLabel(pct, count)).toBe(label);
  });

  it('gives no label under 10 reviews, like Steam', () => {
    expect(steamReviewLabel(100, 9)).toBeNull();
    expect(steamReviewTitle(100, 9)).toBe('100% positive · 9 Steam reviews');
  });
});

describe('reviewsChanged', () => {
  const stored = { app_id: 1, steam_review_score: 90, steam_review_count: 1000 };

  it('saves a change in the percentage', () => {
    expect(reviewsChanged(stored, { score: 89, count: 1000 })).toBe(true);
  });

  it('ignores a handful of new reviews', () => {
    expect(reviewsChanged(stored, { score: 90, count: 1050 })).toBe(false);
  });

  it('saves a big jump in review count', () => {
    expect(reviewsChanged(stored, { score: 90, count: 1100 })).toBe(true);
  });

  it('saves scores for games that had none', () => {
    expect(
      reviewsChanged(
        { app_id: 2, steam_review_score: null, steam_review_count: null },
        { score: 75, count: 26487 },
      ),
    ).toBe(true);
  });
});
