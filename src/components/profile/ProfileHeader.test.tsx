import { render, screen, within } from '@testing-library/react';
import { ProfileHeader } from '@/components/profile/ProfileHeader';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const figures = { games: 217, finished: 44, finishedThisYear: 1, hours: 1065, avgRating: null };
const props = {
  name: 'Ankrath',
  username: 'ankrath',
  avatar: null,
  figures,
};

it('names the player as the page title, with their username under it and nothing else', () => {
  render(<ProfileHeader {...props} />);
  const name = screen.getByRole('heading', { level: 1, name: 'Ankrath' });
  expect(name.nextElementSibling).toHaveTextContent(/^@ankrath$/);
  // When the account was made is on Settings, not here.
  expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
});

it('shows the avatar, or the initial without one', () => {
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

it('has nothing to press: the name, picture and username are changed on Settings', () => {
  render(<ProfileHeader {...props} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  // Not a link either: on their own Profile it would lead back to it.
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('gives the library in four figures, each with its label', () => {
  render(<ProfileHeader {...props} />);
  const strip = document.querySelector('dl')!;
  const read = within(strip)
    .getAllByRole('definition')
    .map((figure) => figure.textContent);
  expect(read).toEqual(['217', '44', '1', '1,065']);
  expect(within(strip).getByText('Games')).toBeInTheDocument();
  expect(within(strip).getByText('Finished')).toBeInTheDocument();
  expect(within(strip).getByText('This year')).toBeInTheDocument();
  expect(within(strip).getByText('Hours played')).toBeInTheDocument();
});

it('keeps its height until the username is known', () => {
  render(<ProfileHeader {...props} username={null} />);
  expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  // The line under the name is there, empty.
  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading.nextElementSibling).toHaveClass('min-h-5');
  expect(heading.nextElementSibling).toBeEmptyDOMElement();
});
