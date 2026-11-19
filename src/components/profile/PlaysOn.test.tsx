import { render, screen } from '@testing-library/react';
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
  expect(screen.getByRole('link', { name: 'Switch 2 19 games' })).toHaveAttribute(
    'href',
    '/games?platform=Switch%202',
  );
  expect(screen.getByRole('link', { name: 'N64 1 game' })).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('lists every platform, however many: none folded away', () => {
  render(<PlaysOn platforms={eight} />);
  expect(names()).toEqual(['PC', 'Switch 2', 'DS', '3DS', 'GBA', 'PS5', 'PS3', 'N64']);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('draws nothing for a library with no platforms', () => {
  const { container } = render(<PlaysOn platforms={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("lists them without links on someone else's profile: the Games page is the visitor's own", () => {
  render(
    <PlaysOn
      linked={false}
      platforms={[
        { name: 'PC', count: 151 },
        { name: 'N64', count: 1 },
      ]}
    />,
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'PC 151 games',
    'N64 1 game',
  ]);
});

it('is headed Platforms, with how many there are at its far end, ruled off from the list', () => {
  render(<PlaysOn platforms={eight} />);
  const heading = screen.getByRole('heading', { level: 2, name: 'Platforms' });
  const count = heading.nextElementSibling!;
  expect(count).toHaveTextContent(/^8$/);
  // The list says how many it holds: the number is only looked at.
  expect(count).toHaveAttribute('aria-hidden', 'true');
  expect(heading.parentElement).toHaveClass('border-b', 'border-ink-800');
});
