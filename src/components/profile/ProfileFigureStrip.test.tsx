import { render, screen } from '@testing-library/react';
import { ProfileFigureStrip } from '@/components/profile/ProfileFigureStrip';

const figures = { backlog: 217, finished: 44, finishedThisYear: 1, hours: 1065, avgRating: null };

const read = () =>
  screen
    .getAllByRole('term')
    .map((label) => [label.textContent, label.parentElement!.querySelector('dd')!.textContent]);

it('is four figures until enough games are rated for an average', () => {
  const { container } = render(<ProfileFigureStrip figures={figures} />);
  expect(read()).toEqual([
    ['Backlog', '217'],
    ['Finished', '44'],
    ['This year', '1'],
    // Both labels are in the markup: the short one is shown on the narrowest phones.
    ['HoursHours played', '1,065'],
  ]);
  expect(container.querySelector('dl')).toHaveClass('grid-cols-4');
});

it('ends with the average rating once there is one, in a strip of five', () => {
  const { container } = render(<ProfileFigureStrip figures={{ ...figures, avgRating: 7.4 }} />);
  expect(read().at(-1)).toEqual(['RatingAvg rating', '7.4']);
  expect(read()).toHaveLength(5);
  // Each as wide as what it holds: five equal columns cut the labels on a phone.
  expect(container.querySelector('dl')).toHaveClass('grid-cols-[repeat(5,auto)]');
});

it('says a whole average to one decimal, so it is not read as a count', () => {
  render(<ProfileFigureStrip figures={{ ...figures, avgRating: 8 }} />);
  expect(read().at(-1)![1]).toBe('8.0');
});

it('shows one of the two labels at any width', () => {
  render(<ProfileFigureStrip figures={{ ...figures, avgRating: 8 }} />);
  expect(screen.getByText('Rating')).toHaveClass('min-[400px]:hidden');
  expect(screen.getByText('Avg rating')).toHaveClass('max-[399px]:hidden');
});
