import { fireEvent, render, screen } from '@testing-library/react';
import { AccountPanel } from '@/components/profile/AccountPanel';

const onConnectSteam = jest.fn();
const onChangeEmail = jest.fn();
const onChangePassword = jest.fn();
const props = {
  email: 'player@example.com',
  steam: null,
  onConnectSteam,
  onChangeEmail,
  onChangePassword,
};

beforeEach(() => jest.clearAllMocks());

/** A setting's value, by its label. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling;

it('shows the email, and the password hidden', () => {
  render(<AccountPanel {...props} />);
  expect(valueOf('Email')).toHaveTextContent('player@example.com');
  // Dots to look at; "Hidden" for a screen reader.
  expect(valueOf('Password')).toHaveTextContent('••••••••Hidden');
});

it('changes the email and the password, each from its own button', () => {
  render(<AccountPanel {...props} />);
  // Each says "Change", named for its setting.
  fireEvent.click(screen.getByRole('button', { name: 'Change email' }));
  expect(onChangeEmail).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  expect(onChangePassword).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/comes next/)).not.toBeInTheDocument();
});

it('shows a new email waiting for its link under the one in use', () => {
  const { rerender } = render(<AccountPanel {...props} />);
  expect(screen.queryByText(/Changing to/)).not.toBeInTheDocument();

  rerender(<AccountPanel {...props} pendingEmail="new@example.com" />);
  expect(valueOf('Email')).toHaveTextContent('player@example.com');
  expect(screen.getByText('Changing to new@example.com, once confirmed')).toBeInTheDocument();
});

it('offers to connect Steam when it is not', () => {
  render(<AccountPanel {...props} />);
  expect(valueOf('Steam')).toHaveTextContent('Not connected');
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  expect(onConnectSteam).toHaveBeenCalledTimes(1);
});

it('says who Steam is connected as, with nothing to connect', () => {
  const { rerender } = render(<AccountPanel {...props} steam={{ username: 'Ankrath' }} />);
  expect(valueOf('Steam')).toHaveTextContent('Connected as Ankrath');
  expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();

  // Steam gave no name.
  rerender(<AccountPanel {...props} steam={{ username: null }} />);
  expect(valueOf('Steam')).toHaveTextContent(/^Connected$/);
});
