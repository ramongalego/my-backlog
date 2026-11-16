import { act, fireEvent, render, screen } from '@testing-library/react';
import { AccountPanel } from '@/components/profile/AccountPanel';

const onConnectSteam = jest.fn();
const onChangeEmail = jest.fn();
const onChangePassword = jest.fn();
const onDisconnectSteam = jest.fn();
const onDeleteAccount = jest.fn();
const onDownloadData = jest.fn();
const onSetPassword = jest.fn<Promise<boolean>, []>();
const props = {
  email: 'player@example.com',
  signIn: { hasPassword: true, providers: [] },
  onSetPassword,
  steam: null,
  onConnectSteam,
  onChangeEmail,
  onChangePassword,
  onDisconnectSteam,
  onDeleteAccount,
  onDownloadData,
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

it('disconnects Steam from its row when it is connected', () => {
  render(<AccountPanel {...props} steam={{ username: 'Ankrath' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect Steam' }));
  expect(onDisconnectSteam).toHaveBeenCalledTimes(1);
});

it('keeps Delete account behind More options until it is asked for', () => {
  render(<AccountPanel {...props} />);
  const more = screen.getByRole('button', { name: 'More options' });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument();

  fireEvent.click(more);
  expect(more).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(more.getAttribute('aria-controls')!)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
  expect(onDeleteAccount).toHaveBeenCalledTimes(1);

  // And it folds away again.
  fireEvent.click(more);
  expect(screen.queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument();
});

it('lets a waiting email wrap, so the whole address can be checked', () => {
  render(<AccountPanel {...props} pendingEmail="a.very.long.address@example-domain.com" />);
  const note = screen.getByText(/Changing to a\.very\.long/);
  expect(note).not.toHaveClass('truncate');
  expect(note).toHaveClass('[overflow-wrap:anywhere]');
});

it('keeps Export data behind More options too, as a menu of the two files', async () => {
  onDownloadData.mockResolvedValue({ ok: true });
  render(<AccountPanel {...props} />);
  expect(screen.queryByRole('button', { name: 'Export data' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
  expect(screen.getByText('Download a copy of your data')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Export data' }));
  await act(async () => fireEvent.click(screen.getByRole('menuitem', { name: 'Games (CSV)' })));
  expect(onDownloadData).toHaveBeenCalledWith('csv');
});

it('leaves Export data out when there is nothing to copy', () => {
  render(<AccountPanel {...props} onDownloadData={undefined} />);
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
  expect(screen.queryByRole('button', { name: 'Export data' })).not.toBeInTheDocument();
  expect(screen.queryByText('Download a copy of your data')).not.toBeInTheDocument();
  // Delete account is still there.
  expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
});

describe('an account with no password (made with Google or Discord)', () => {
  const noPassword = {
    ...props,
    signIn: { hasPassword: false, providers: ['google'] as const },
  };

  it('says there is none and how they sign in, with nothing to change', () => {
    render(<AccountPanel {...noPassword} />);
    expect(valueOf('Password')).toHaveTextContent('Not set');
    expect(screen.getByText('You sign in with Google')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
  });

  it('names both when they sign in with either', () => {
    render(
      <AccountPanel
        {...noPassword}
        signIn={{ hasPassword: false, providers: ['google', 'discord'] }}
      />,
    );
    expect(screen.getByText('You sign in with Google or Discord')).toBeInTheDocument();
  });

  it("can't change the email until it has a password, and says so", () => {
    render(<AccountPanel {...noPassword} />);
    expect(valueOf('Email')).toHaveTextContent('player@example.com');
    expect(screen.queryByRole('button', { name: 'Change email' })).not.toBeInTheDocument();
    expect(screen.getByText('Set a password to change your email')).toBeInTheDocument();
  });

  it('emails the link that sets one, once, and says where it went', async () => {
    let done!: (sent: boolean) => void;
    onSetPassword.mockReturnValue(new Promise((resolve) => (done = resolve)));
    render(<AccountPanel {...noPassword} />);
    const button = screen.getByRole('button', { name: 'Set password' });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(onSetPassword).toHaveBeenCalledTimes(1);
    // Busy, not disabled: it keeps the focus while it sends.
    expect(screen.getByRole('button', { name: 'Sending…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await act(async () => done(true));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(
      'We emailed a link to player@example.com. Open it to choose a password.',
    );
    // The button is gone: focus is on the line that says so, not lost.
    expect(screen.queryByRole('button', { name: /Set password|Sending/ })).not.toBeInTheDocument();
    expect(status).toHaveFocus();
  });

  it('says when the link could not be sent, and can be tried again', async () => {
    onSetPassword.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<AccountPanel {...noPassword} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Set password' })));
    expect(screen.getByRole('status')).toHaveTextContent(
      "Couldn't send the link. Please try again.",
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Set password' })));
    expect(onSetPassword).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('We emailed a link');
  });
});
