import { fireEvent, render, screen } from '@testing-library/react';
import { FavoritesUnavailable } from '@/components/profile/FavoritesUnavailable';

const onRetry = jest.fn();
beforeEach(() => onRetry.mockClear());

it("says the favorites couldn't be loaded, with a way to try again", () => {
  render(<FavoritesUnavailable failed onRetry={onRetry} />);
  expect(screen.getByRole('region', { name: 'Favorite games' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your favorites");
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it('says they are loading while they are on their way', () => {
  render(<FavoritesUnavailable failed={false} onRetry={onRetry} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading your favorites…');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('never offers a place to pick into: that would save over the favorites that did not load', () => {
  render(<FavoritesUnavailable failed onRetry={onRetry} />);
  expect(screen.queryByRole('button', { name: 'Add a favorite game' })).not.toBeInTheDocument();
});
