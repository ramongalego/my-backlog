import { render, screen } from '@testing-library/react';
import { RatingSpread } from '@/components/profile/RatingSpread';

//                0  1  2  3  4  5  6  7  8  9  10
const counts = [0, 0, 0, 0, 1, 0, 2, 3, 6, 9, 1];

const bars = () => [...screen.getByRole('img').children] as HTMLElement[];

it('is a bar for each rating from 0 to 10, as tall as the games given it', () => {
  render(<RatingSpread counts={counts} />);
  expect(screen.getByRole('heading', { level: 2, name: 'Ratings' })).toBeInTheDocument();
  expect(bars()).toHaveLength(11);
  // The most given is the full height; the rest are in proportion to it.
  expect(bars()[9]).toHaveStyle({ height: '56px' });
  expect(bars()[8].style.height).toBe(`${(6 / 9) * 56}px`);
  // The amber Stats draws its rating bars in.
  expect(bars()[9]).toHaveClass('bg-amber-400/80');
});

it('keeps a rating nobody was given as a mark on the line, and one game tall enough to see', () => {
  render(<RatingSpread counts={[0, 0, 0, 0, 0, 0, 0, 0, 1, 40, 0]} />);
  expect(bars()[0]).toHaveStyle({ height: '2px' });
  expect(bars()[0]).toHaveClass('bg-ink-800');
  // One game in forty would be a pixel and a half.
  expect(bars()[8]).toHaveStyle({ height: '4px' });
});

it('says how many games it is drawn from, and the two ends of the scale', () => {
  render(<RatingSpread counts={counts} />);
  expect(screen.getByText('22')).toBeInTheDocument();
  // Ruled off from the bars, so the count isn't read as one bar's number.
  expect(screen.getByText('22').parentElement).toHaveClass('border-b', 'border-ink-800');
  expect(screen.getByText('0')).toBeInTheDocument();
  expect(screen.getByText('10')).toBeInTheDocument();
  // No number on any bar: only the shape.
  expect(screen.getByRole('img')).toHaveTextContent('');
});

it('says in words what the bars show, naming only the ratings given', () => {
  render(<RatingSpread counts={counts} />);
  expect(screen.getByRole('img')).toHaveAccessibleName(
    '22 rated games: 1 at 4/10, 2 at 6/10, 3 at 7/10, 6 at 8/10, 9 at 9/10, 1 at 10/10',
  );
  // What is drawn beside it would only be said twice.
  expect(screen.getByText('22')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByText('10').parentElement).toHaveAttribute('aria-hidden', 'true');
});

it('names a bar on hover, with its games', () => {
  render(<RatingSpread counts={counts} />);
  expect(bars()[9]).toHaveAttribute('title', '9/10: 9 games');
  expect(bars()[4]).toHaveAttribute('title', '4/10: 1 game');
  expect(bars()[0]).not.toHaveAttribute('title');
});

it('draws nothing until enough games are rated', () => {
  const { container } = render(<RatingSpread counts={null} />);
  expect(container).toBeEmptyDOMElement();
});
