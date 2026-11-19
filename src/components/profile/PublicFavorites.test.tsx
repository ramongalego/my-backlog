import { render, screen, within } from '@testing-library/react';
import { PublicFavorites } from '@/components/profile/PublicFavorites';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const games = [
  { name: 'Celeste', header_image: 'https://example.com/celeste.jpg', rating: 10 },
  { name: 'Hades', header_image: 'https://example.com/hades.jpg', rating: null },
];

it('shows the favorites in the order picked, each with its name and rating', () => {
  render(<PublicFavorites games={games} />);
  const section = screen.getByRole('region', { name: 'Favorite games' });
  const items = within(section).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('10/10');
  expect(items[0]).toHaveTextContent('Celeste');
  // No rating, no chip.
  expect(items[1]).toHaveTextContent(/^\s*Hades$/);
});

it('is only to look at: nothing opens, moves or comes off', () => {
  render(<PublicFavorites games={games} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByText('Drag to reorder')).not.toBeInTheDocument();
});

it('has no section, and no empty places, when none are picked', () => {
  const { container } = render(<PublicFavorites games={[]} />);
  expect(container).toBeEmptyDOMElement();
});
