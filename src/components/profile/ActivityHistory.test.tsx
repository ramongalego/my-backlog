import { render, screen } from '@testing-library/react';
import { ActivityHistory } from '@/components/profile/ActivityHistory';

// Friday, Nov 20, 2026: its week began Sunday, Nov 15, and the first of the
// 26 weeks on Sunday, May 24.
const today = '2026-11-20';
const grid = () => screen.getByRole('img');
const squares = () => [...grid().children] as HTMLElement[];

it('is a square a day for 26 weeks, ending today, a column a week from Sunday', () => {
  render(<ActivityHistory days={{ '2026-11-18': 2 }} today={today} />);
  // 25 whole weeks, and this one up to Friday.
  expect(squares()).toHaveLength(25 * 7 + 6);
  expect(grid()).toHaveStyle({ gridTemplateColumns: 'repeat(26, minmax(0, 1fr))' });
});

it('says the day and how much on a lit square, and nothing on an empty one', () => {
  render(<ActivityHistory days={{ '2026-11-18': 2, '2026-05-31': 1 }} today={today} />);
  const lit = squares().filter((square) => square.textContent);
  expect(lit.map((square) => square.textContent)).toEqual([
    'Sun, May 31, 2026' + '1 update',
    'Wed, Nov 18, 2026' + '2 updates',
  ]);
  // Shown by hovering the square, at once, and only drawn: the grid's name says it.
  expect(lit[0]).toHaveClass('group/tip');
  expect(lit[0].firstElementChild).toHaveClass('hidden', 'group-hover/tip:block');
  expect(lit[0].firstElementChild).toHaveAttribute('aria-hidden', 'true');
  expect(squares()[1]).toBeEmptyDOMElement();
});

it('lights a day more the more was done, in the accent', () => {
  const days = { '2026-11-15': 1, '2026-11-16': 2, '2026-11-17': 4, '2026-11-18': 7 };
  render(<ActivityHistory days={days} today={today} />);
  const last = squares().slice(-6);
  expect(last.map((square) => square.className.match(/bg-\S+/)![0])).toEqual([
    'bg-accent-500/35',
    'bg-accent-500/60',
    'bg-accent-500/85',
    'bg-accent-400',
    'bg-ink-950',
    'bg-ink-950',
  ]);
});

it('is one image for a screen reader, named with how many days were active', () => {
  render(<ActivityHistory days={{ '2026-11-18': 2, '2026-11-19': 1 }} today={today} />);
  expect(grid()).toHaveAccessibleName('Active on 2 days in the last 26 weeks');
  expect(screen.getByText('Activity')).toBeInTheDocument();
});

it("isn't there when nothing was done in its weeks, even if something was before them", () => {
  const { container } = render(<ActivityHistory days={{ '2026-05-23': 3 }} today={today} />);
  expect(container).toBeEmptyDOMElement();
});
