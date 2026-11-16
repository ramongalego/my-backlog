import { render, screen } from '@testing-library/react';
import { PlaysOn } from '@/components/profile/PlaysOn';

const platforms = (names: string[]) => names.map((name, i) => ({ name, count: 20 - i }));

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
});

it('names six, and counts the rest', () => {
  render(
    <PlaysOn platforms={platforms(['PC', 'Switch 2', 'DS', '3DS', 'GBA', 'PS5', 'PS3', 'N64'])} />,
  );
  expect(screen.getAllByRole('link')).toHaveLength(6);
  expect(screen.getByText('and 2 more platforms')).toBeInTheDocument();
});

it('says "1 more platform" for one', () => {
  render(<PlaysOn platforms={platforms(['PC', 'Switch 2', 'DS', '3DS', 'GBA', 'PS5', 'PS3'])} />);
  expect(screen.getByText('and 1 more platform')).toBeInTheDocument();
});

it('draws nothing for a library with no platforms', () => {
  const { container } = render(<PlaysOn platforms={[]} />);
  expect(container).toBeEmptyDOMElement();
});
