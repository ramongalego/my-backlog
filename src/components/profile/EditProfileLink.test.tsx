import { render, screen } from '@testing-library/react';
import { EditProfileLink } from '@/components/profile/EditProfileLink';
import { ProfileHeader } from '@/components/profile/ProfileHeader';

const header = {
  name: 'Ankrath',
  username: 'ankrath',
  avatar: null,
  figures: { backlog: 217, finished: 44, finishedThisYear: 1, hours: 1065, avgRating: null },
};

it('leads to Settings, where the profile is changed', () => {
  render(<EditProfileLink />);
  expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/settings');
});

it('is the pencil alone on phones, still named by its words', () => {
  render(<EditProfileLink />);
  const link = screen.getByRole('link', { name: 'Edit profile' });
  expect(screen.getByText('Edit profile')).toHaveClass('max-sm:sr-only');
  expect(link).toHaveClass('max-sm:w-8', 'h-8');
  expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
});

it("sits in the header beside the name, on the player's own Profile", () => {
  render(<ProfileHeader {...header} action={<EditProfileLink />} />);
  const link = screen.getByRole('link', { name: 'Edit profile' });
  const name = screen.getByRole('heading', { level: 1, name: 'Ankrath' });
  // After the name in reading order, in the same row.
  expect(name.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(link.parentElement).toContainElement(name);
});

it('is not there unless the page gives it: the page other people see has none', () => {
  render(<ProfileHeader {...header} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
