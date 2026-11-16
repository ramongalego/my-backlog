import { fireEvent, render, screen } from '@testing-library/react';
import { AccountPanel } from '@/components/profile/AccountPanel';

const onConnectSteam = jest.fn();
const props = { email: 'player@example.com', steam: null, onConnectSteam };

beforeEach(() => onConnectSteam.mockClear());

/** A setting's value, by its label. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling;

it('shows the email, and the password hidden', () => {
  render(<AccountPanel {...props} />);
  expect(valueOf('Email')).toHaveTextContent('player@example.com');
  // Dots to look at; "Hidden" for a screen reader.
  expect(valueOf('Password')).toHaveTextContent('••••••••Hidden');
});

it('has Change in place for both, not yet working', () => {
  render(<AccountPanel {...props} />);
  const buttons = screen.getAllByRole('button', { name: 'Change' });
  expect(buttons).toHaveLength(2);
  for (const button of buttons) expect(button).toBeDisabled();
  expect(screen.getByText('Changing your email and password comes next')).toBeInTheDocument();
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
