import { render, screen, within } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

it('links to the policies and gives a way to write to us', () => {
  render(<Footer />);
  const nav = screen.getByRole('navigation', { name: 'Footer' });
  expect(within(nav).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  expect(within(nav).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  expect(within(nav).getByRole('link', { name: 'Contact' })).toHaveAttribute(
    'href',
    'mailto:contact@mybacklog.co',
  );
});

it('says whose site it is, this year', () => {
  render(<Footer />);
  expect(screen.getByText('MyBacklog')).toBeInTheDocument();
  expect(screen.getByText(`© ${new Date().getFullYear()}`)).toBeInTheDocument();
});

it('credits where the game data comes from, and says it is not a Valve site', () => {
  render(<Footer />);
  const credits = screen.getByText(/Game data from/);
  expect(credits).toHaveTextContent(
    'Game data from Steam, IGDB, HowLongToBeat and SteamGridDB. Not affiliated with Valve.',
  );
  for (const name of ['Steam', 'IGDB', 'HowLongToBeat', 'SteamGridDB']) {
    const link = within(credits).getByRole('link', { name });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});
