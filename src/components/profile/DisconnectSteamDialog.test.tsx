import { act, fireEvent, render, screen } from '@testing-library/react';
import { DisconnectSteamDialog } from '@/components/profile/DisconnectSteamDialog';

type Result = { ok: true } | { ok: false; error: string };
const onDisconnect = jest.fn<Promise<Result>, []>();
const onClose = jest.fn();
const onDownloadData = jest.fn();

const open = (steamGames = 151) =>
  render(
    <DisconnectSteamDialog
      steamGames={steamGames}
      onDisconnect={onDisconnect}
      onDownloadData={onDownloadData}
      onClose={onClose}
    />,
  );
const disconnect = () => screen.getByRole('button', { name: /Disconnect|Disconnecting/ });

beforeEach(() => {
  jest.clearAllMocks();
  onDisconnect.mockResolvedValue({ ok: true });
});

it('says plainly what is lost for good, and what stays', () => {
  open();
  expect(screen.getByRole('dialog', { name: 'Disconnect Steam' })).toHaveTextContent(
    'Your 151 Steam games and their ratings, notes and finish dates will be permanently removed. Games on other consoles stay.',
  );
  // Reconnecting brings the games back, just not what was logged on them.
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Connecting Steam again brings the games back, but not their ratings, notes or finish dates.',
  );
});

it('says it for one game, and leaves the count out with none', () => {
  const { unmount } = open(1);
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Your Steam game and its rating, notes and finish date will be permanently removed.',
  );
  unmount();
  open(0);
  expect(screen.getByRole('dialog')).not.toHaveTextContent('permanently removed');
  expect(screen.getByRole('dialog')).toHaveTextContent('Games on other consoles stay.');
});

it('disconnects once, however many times it is pressed', async () => {
  let done!: (result: Result) => void;
  onDisconnect.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  await act(async () => {
    fireEvent.click(disconnect());
    fireEvent.click(disconnect());
  });
  expect(onDisconnect).toHaveBeenCalledTimes(1);
  await act(async () => done({ ok: true }));
  expect(disconnect()).toHaveTextContent('Disconnecting…');
});

it('says why it failed, and can be tried again', async () => {
  onDisconnect.mockResolvedValueOnce({
    ok: false,
    error: "Couldn't disconnect Steam. Please try again.",
  });
  open();
  await act(async () => fireEvent.click(disconnect()));
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't disconnect Steam.");
  await act(async () => fireEvent.click(disconnect()));
  expect(onDisconnect).toHaveBeenCalledTimes(2);
});

it('closes on Cancel without disconnecting', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onDisconnect).not.toHaveBeenCalled();
});

it('offers a copy of the data first, when there are games to lose', async () => {
  onDownloadData.mockResolvedValue({ ok: true });
  const { unmount } = open();
  expect(screen.getByText('Want a copy first?')).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Games (CSV)' })));
  expect(onDownloadData).toHaveBeenCalledWith('csv');
  expect(onDisconnect).not.toHaveBeenCalled();
  unmount();

  // Nothing comes out with it: nothing to keep a copy of.
  open(0);
  expect(screen.queryByText('Want a copy first?')).not.toBeInTheDocument();
});
