import { act, fireEvent, render, screen } from '@testing-library/react';
import { SocialSignIn } from '@/components/auth/SocialSignIn';

const signInWithOAuth = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

const google = () => screen.getByRole('button', { name: 'Continue with Google' });
const discord = () => screen.getByRole('button', { name: 'Continue with Discord' });

beforeEach(() => {
  jest.clearAllMocks();
  signInWithOAuth.mockResolvedValue({ error: null });
});
afterEach(() => jest.useRealTimers());

it('offers Google, then Discord, above an "or"', () => {
  render(<SocialSignIn />);
  const buttons = screen.getAllByRole('button').map((button) => button.textContent);
  expect(buttons).toEqual(['Continue with Google', 'Continue with Discord']);
  expect(screen.getByText('or')).toBeInTheDocument();
});

it('leaves for the site pressed, to come back through the callback to Home', async () => {
  render(<SocialSignIn />);
  await act(async () => fireEvent.click(discord()));
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: 'discord',
    options: { redirectTo: `${window.location.origin}/auth/callback?flow=sign-in&next=/home` },
  });
});

it('starts once however fast it is pressed, on either button', async () => {
  render(<SocialSignIn />);
  await act(async () => {
    fireEvent.click(google());
    fireEvent.click(google());
    fireEvent.click(discord());
  });
  expect(signInWithOAuth).toHaveBeenCalledTimes(1);
  expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));
});

it('marks both busy, not disabled, while the other site is on its way', async () => {
  render(<SocialSignIn />);
  await act(async () => fireEvent.click(google()));
  expect(google()).toHaveAttribute('aria-busy', 'true');
  expect(google()).toHaveAttribute('aria-disabled', 'true');
  expect(discord()).toHaveAttribute('aria-disabled', 'true');
  expect(discord()).not.toHaveAttribute('aria-busy');
  expect(google()).not.toBeDisabled();
});

it('can be pressed again after coming back with the Back button', async () => {
  render(<SocialSignIn />);
  await act(async () => fireEvent.click(google()));
  await act(async () => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  expect(google()).not.toHaveAttribute('aria-busy');
  await act(async () => fireEvent.click(discord()));
  expect(signInWithOAuth).toHaveBeenCalledTimes(2);
});

it("gives up after a while if the other site's page never came", async () => {
  jest.useFakeTimers();
  render(<SocialSignIn />);
  await act(async () => fireEvent.click(google()));
  expect(google()).toHaveAttribute('aria-busy', 'true');
  act(() => jest.advanceTimersByTime(20_000));
  expect(google()).not.toHaveAttribute('aria-busy');
});

it("says so when it couldn't start, and can be tried again", async () => {
  signInWithOAuth.mockResolvedValueOnce({ error: { message: 'boom' } });
  render(<SocialSignIn />);
  await act(async () => fireEvent.click(google()));
  expect(screen.getByRole('alert')).toHaveTextContent(
    "Couldn't start signing in. Please try again.",
  );
  expect(google()).not.toHaveAttribute('aria-busy');

  await act(async () => fireEvent.click(google()));
  expect(signInWithOAuth).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('says so when starting throws, too', async () => {
  signInWithOAuth.mockRejectedValueOnce(new Error('offline'));
  render(<SocialSignIn />);
  await act(async () => fireEvent.click(discord()));
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
