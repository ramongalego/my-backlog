import { fireEvent, render, screen } from '@testing-library/react';
import { PlaysOn } from '@/components/profile/PlaysOn';

const platforms = (names: string[]) => names.map((name, i) => ({ name, count: 20 - i }));
const eight = platforms(['PC', 'Switch 2', 'DS', '3DS', 'GBA', 'PS5', 'PS3', 'N64']);
const names = () => screen.getAllByRole('link').map((link) => link.firstChild?.textContent);

it('lists each platform with its games, as a link to the Games page listing it', () => {
  render(
    <PlaysOn
      platforms={[
        { name: 'PC', count: 151 },
        { name: 'Switch 2', count: 19 },
        { name: 'N64', count: 1 },
      ]}
    />,
  );

  expect(screen.getByRole('link', { name: 'PC 151 games' })).toHaveAttribute(
    'href',
    '/games?platform=PC',
  );
  // A name with a space is encoded for the address.
  expect(screen.getByRole('link', { name: 'Switch 2 19 games' })).toHaveAttribute(
    'href',
    '/games?platform=Switch%202',
  );
  expect(screen.getByRole('link', { name: 'N64 1 game' })).toBeInTheDocument();
  // Nothing to open up.
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('names five, and opens up to all of them from the line counting the rest', () => {
  render(<PlaysOn platforms={eight} />);
  expect(names()).toEqual(['PC', 'Switch 2', 'DS', '3DS', 'GBA']);

  const more = screen.getByRole('button', { name: 'and 3 more platforms' });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(more);

  expect(names()).toEqual(['PC', 'Switch 2', 'DS', '3DS', 'GBA', 'PS5', 'PS3', 'N64']);
  // The same button, now closing it again.
  expect(more).toHaveAttribute('aria-expanded', 'true');
  expect(more).toHaveTextContent('Show fewer');
});

it('closes again to the first five', () => {
  render(<PlaysOn platforms={eight} />);
  fireEvent.click(screen.getByRole('button', { name: 'and 3 more platforms' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
  expect(names()).toHaveLength(5);
  expect(screen.getByRole('button', { name: 'and 3 more platforms' })).toBeInTheDocument();
});

it('says which list it opens', () => {
  render(<PlaysOn platforms={eight} />);
  const list = screen.getByRole('list');
  expect(screen.getByRole('button')).toHaveAttribute('aria-controls', list.id);
});

it('shows a sixth rather than hide one behind a click', () => {
  render(<PlaysOn platforms={eight.slice(0, 6)} />);
  expect(names()).toHaveLength(6);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('draws nothing for a library with no platforms', () => {
  const { container } = render(<PlaysOn platforms={[]} />);
  expect(container).toBeEmptyDOMElement();
});
