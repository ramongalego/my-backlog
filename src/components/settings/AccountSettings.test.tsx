import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AccountSettings } from '@/components/settings/AccountSettings';

const onConnectSteam = jest.fn();
const onChangeEmail = jest.fn();
const onChangePassword = jest.fn();
const onDisconnectSteam = jest.fn();
const onDeleteAccount = jest.fn();
const onDownloadData = jest.fn();
const onSetPassword = jest.fn<Promise<boolean>, []>();
const onChangeUsername = jest.fn();
const onChangeName = jest.fn();
const onSetPrivate = jest.fn();
const profile = {
  name: 'Mist Kai',
  avatar: null,
  hasOwnPicture: false,
  onChangeName,
  onUploadPicture: jest.fn(async () => ({ ok: true as const })),
  onRemovePicture: jest.fn(async () => ({ ok: true as const })),
  isPrivate: false as boolean | null,
  onSetPrivate,
};
const props = {
  profile,
  username: 'mistkai',
  onChangeUsername,
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

const valueOf = (label: string) => screen.getByText(label).nextElementSibling;

it('shows the email, and the password hidden', () => {
  render(<AccountSettings {...props} />);
  expect(valueOf('Email')).toHaveTextContent('player@example.com');
  // Dots to look at; "Hidden" for a screen reader.
  expect(valueOf('Password')).toHaveTextContent('••••••••Hidden');
});

describe('the profile', () => {
  it('is the avatar, the display name, the username and who can see it, in that order', () => {
    render(<AccountSettings {...props} />);
    const rows = within(screen.getAllByRole('list')[0]).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('p')!.textContent)).toEqual([
      'Avatar',
      'Display name',
      'Username',
      'Who can see your profile',
    ]);
  });

  it('changes the display name and the username, each from its own button', () => {
    render(<AccountSettings {...props} />);
    expect(valueOf('Display name')).toHaveTextContent('Mist Kai');
    fireEvent.click(screen.getByRole('button', { name: 'Change display name' }));
    expect(onChangeName).toHaveBeenCalledTimes(1);

    expect(valueOf('Username')).toHaveTextContent('mistkai');
    fireEvent.click(screen.getByRole('button', { name: 'Change username' }));
    expect(onChangeUsername).toHaveBeenCalledTimes(1);
  });

  it('changes the avatar from its row', () => {
    render(<AccountSettings {...props} />);
    expect(screen.getByRole('button', { name: 'Change avatar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove avatar' })).not.toBeInTheDocument();
  });

  it('is public, and says where it is', () => {
    render(<AccountSettings {...props} />);
    expect(valueOf('Who can see your profile')).toHaveTextContent('Anyone with the link');
    expect(screen.getByText('mybacklog.co/u/mistkai')).toBeInTheDocument();
    const pick = screen.getByRole('group', { name: 'Who can see your profile' });
    expect(within(pick).getByRole('button', { name: 'Public' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(within(pick).getByRole('button', { name: 'Private' }));
    expect(onSetPrivate).toHaveBeenCalledWith(true);
  });

  it('puts the switch under its text on the narrowest phones, where the two would not fit', () => {
    render(<AccountSettings {...props} />);
    const row = (label: string) => screen.getByText(label).closest('li');
    expect(row('Who can see your profile')).toHaveClass(
      'max-[359px]:flex-col',
      'max-[359px]:items-start',
    );
    // A row with a button keeps it beside the value.
    expect(row('Username')).not.toHaveClass('max-[359px]:flex-col');
  });

  it('is private: only the player sees it, and no address is given', () => {
    render(<AccountSettings {...props} profile={{ ...profile, isPrivate: true }} />);
    expect(valueOf('Who can see your profile')).toHaveTextContent('Only you');
    expect(screen.queryByText(/mybacklog\.co\/u\//)).not.toBeInTheDocument();
    const pick = screen.getByRole('group', { name: 'Who can see your profile' });
    expect(within(pick).getByRole('button', { name: 'Private' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(within(pick).getByRole('button', { name: 'Public' }));
    expect(onSetPrivate).toHaveBeenCalledWith(false);
  });

  it('leaves the switch out until the profile has been read, rather than guess', () => {
    render(<AccountSettings {...props} profile={{ ...profile, isPrivate: null }} />);
    expect(screen.queryByText('Who can see your profile')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

it('leaves the username row out until the profile has been read', () => {
  render(<AccountSettings {...props} username={null} />);
  expect(screen.queryByText('Username')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Change username' })).not.toBeInTheDocument();
});

it('says when the account was made, last in Account, with nothing to press', () => {
  const { rerender } = render(<AccountSettings {...props} memberSince="January 2026" />);
  expect(valueOf('Member since')).toHaveTextContent('January 2026');
  const row = screen.getByText('Member since').closest('li')!;
  expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  const account = screen.getByRole('heading', { name: 'Account' }).nextElementSibling!;
  expect(account.lastElementChild).toBe(row);

  // Not known: no row, rather than an empty one.
  rerender(<AccountSettings {...props} memberSince={null} />);
  expect(screen.queryByText('Member since')).not.toBeInTheDocument();
});

it('changes the email and the password, each from its own button', () => {
  render(<AccountSettings {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Change email' }));
  expect(onChangeEmail).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  expect(onChangePassword).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/comes next/)).not.toBeInTheDocument();
});

it('shows a new email waiting for its link under the one in use', () => {
  const { rerender } = render(<AccountSettings {...props} />);
  expect(screen.queryByText(/Changing to/)).not.toBeInTheDocument();

  rerender(<AccountSettings {...props} pendingEmail="new@example.com" />);
  expect(valueOf('Email')).toHaveTextContent('player@example.com');
  expect(screen.getByText('Changing to new@example.com, once confirmed')).toBeInTheDocument();
});

it('offers to connect Steam when it is not', () => {
  render(<AccountSettings {...props} />);
  expect(valueOf('Steam')).toHaveTextContent('Not connected');
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  expect(onConnectSteam).toHaveBeenCalledTimes(1);
});

it('says who Steam is connected as, with nothing to connect', () => {
  const { rerender } = render(<AccountSettings {...props} steam={{ username: 'Ankrath' }} />);
  expect(valueOf('Steam')).toHaveTextContent('Connected as Ankrath');
  expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();

  // Steam gave no name.
  rerender(<AccountSettings {...props} steam={{ username: null }} />);
  expect(valueOf('Steam')).toHaveTextContent(/^Connected$/);
});

it('disconnects Steam from its row when it is connected', () => {
  render(<AccountSettings {...props} steam={{ username: 'Ankrath' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect Steam' }));
  expect(onDisconnectSteam).toHaveBeenCalledTimes(1);
});

it('is four sections: the profile, the account, its connections, and its data', () => {
  render(<AccountSettings {...props} />);
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
    'Profile',
    'Account',
    'Connections',
    'Your data',
  ]);
  // Two columns: what other people see of the player, then the account itself.
  const columns = screen.getByRole('heading', { name: 'Profile' }).closest('.grid')!;
  expect(columns).toHaveClass('lg:grid-cols-2');
  expect(
    [...columns.children].map((column) =>
      within(column as HTMLElement)
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent),
    ),
  ).toEqual([['Profile'], ['Account', 'Connections', 'Your data']]);
  // Nothing folded away: the page is where these are looked for.
  expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument();
});

it('deletes the account from Your data, the last thing on the page', () => {
  render(<AccountSettings {...props} />);
  expect(screen.getByText('Delete your account and everything in it')).toBeVisible();
  const buttons = screen.getAllByRole('button');
  expect(buttons.at(-1)).toHaveAccessibleName('Delete account');
  fireEvent.click(buttons.at(-1)!);
  expect(onDeleteAccount).toHaveBeenCalledTimes(1);
});

it('lets a waiting email wrap, so the whole address can be checked', () => {
  render(<AccountSettings {...props} pendingEmail="a.very.long.address@example-domain.com" />);
  const note = screen.getByText(/Changing to a\.very\.long/);
  expect(note).not.toHaveClass('truncate');
  expect(note).toHaveClass('[overflow-wrap:anywhere]');
});

it('exports the data from a menu of the two files', async () => {
  onDownloadData.mockResolvedValue({ ok: true });
  render(<AccountSettings {...props} />);
  expect(screen.getByText('Download a copy of your data')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Export data' }));
  await act(async () => fireEvent.click(screen.getByRole('menuitem', { name: 'Games (CSV)' })));
  expect(onDownloadData).toHaveBeenCalledWith('csv');
});

it('leaves Export data out when there is nothing to copy', () => {
  render(<AccountSettings {...props} onDownloadData={undefined} />);
  expect(screen.queryByRole('button', { name: 'Export data' })).not.toBeInTheDocument();
  expect(screen.queryByText('Download a copy of your data')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
});

describe('an account with no password (made with Google or Discord)', () => {
  const noPassword = {
    ...props,
    signIn: { hasPassword: false, providers: ['google'] as const },
  };

  it('says there is none and how they sign in, with nothing to change', () => {
    render(<AccountSettings {...noPassword} />);
    expect(valueOf('Password')).toHaveTextContent('Not set');
    expect(screen.getByText('You sign in with Google')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
  });

  it('names both when they sign in with either', () => {
    render(
      <AccountSettings
        {...noPassword}
        signIn={{ hasPassword: false, providers: ['google', 'discord'] }}
      />,
    );
    expect(screen.getByText('You sign in with Google or Discord')).toBeInTheDocument();
  });

  it("can't change the email until it has a password, and says so", () => {
    render(<AccountSettings {...noPassword} />);
    expect(valueOf('Email')).toHaveTextContent('player@example.com');
    expect(screen.queryByRole('button', { name: 'Change email' })).not.toBeInTheDocument();
    expect(screen.getByText('Set a password to change your email')).toBeInTheDocument();
  });

  it('emails the link that sets one, once, and says where it went', async () => {
    let done!: (sent: boolean) => void;
    onSetPassword.mockReturnValue(new Promise((resolve) => (done = resolve)));
    render(<AccountSettings {...noPassword} />);
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
    render(<AccountSettings {...noPassword} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Set password' })));
    expect(screen.getByRole('status')).toHaveTextContent(
      "Couldn't send the link. Please try again.",
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Set password' })));
    expect(onSetPassword).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('We emailed a link');
  });
});
