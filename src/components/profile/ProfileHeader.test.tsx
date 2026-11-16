import { render, screen, within } from '@testing-library/react';
import { ProfileHeader } from '@/components/profile/ProfileHeader';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const figures = { games: 217, finished: 44, finishedThisYear: 1, hours: 1065 };
const props = { name: 'Ankrath', avatar: null, memberSince: 'January 2026', figures };

it('names the player as the page title, with when they joined', () => {
  render(<ProfileHeader {...props} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Ankrath' })).toBeInTheDocument();
  expect(screen.getByText('Member since January 2026')).toBeInTheDocument();
});

it('shows the Steam avatar, or the initial without one', () => {
  const { rerender, container } = render(
    <ProfileHeader {...props} avatar="https://avatars.steamstatic.com/a_full.jpg" />,
  );
  // Decorative: the name is beside it.
  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    'https://avatars.steamstatic.com/a_full.jpg',
  );
  expect(container.querySelector('img')).toHaveAttribute('alt', '');

  rerender(<ProfileHeader {...props} />);
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(screen.getByText('A')).toHaveAttribute('aria-hidden', 'true');
});

it('gives the library in four figures, each with its label', () => {
  render(<ProfileHeader {...props} />);
  const strip = document.querySelector('dl')!;
  const read = within(strip)
    .getAllByRole('definition')
    .map((figure) => figure.textContent);
  // Thousands are grouped.
  expect(read).toEqual(['217', '44', '1', '1,065']);
  expect(within(strip).getByText('Games')).toBeInTheDocument();
  expect(within(strip).getByText('Finished')).toBeInTheDocument();
  expect(within(strip).getByText('This year')).toBeInTheDocument();
  expect(within(strip).getByText('Hours played')).toBeInTheDocument();
});

it('keeps its height without a join date', () => {
  render(<ProfileHeader {...props} memberSince={null} />);
  expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 }).nextElementSibling).toHaveClass('min-h-5');
});

it('has Edit profile in place, not yet working', () => {
  render(<ProfileHeader {...props} />);
  expect(screen.getByRole('button', { name: 'Edit profile' })).toBeDisabled();
});
