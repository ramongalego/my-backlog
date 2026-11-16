import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { UrlErrorToast } from '@/components/layout/UrlErrorToast';
import { STEAM_PRIVACY_URL } from '@/lib/steam/privacy';

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

let query = '';
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query),
  usePathname: () => '/home',
  useRouter: () => ({ replace }),
}));

beforeEach(() => jest.clearAllMocks());

it('shows the message for an error code, then takes the code out of the address', () => {
  query = 'error=steam_api_failed&tab=1';
  render(<UrlErrorToast />);

  expect(toast.error).toHaveBeenCalledWith("Couldn't reach Steam. Please try again in a moment.", {
    id: 'url-error-steam_api_failed',
  });
  expect(replace).toHaveBeenCalledWith('/home?tab=1', { scroll: false });
});

it('says nothing without a code', () => {
  query = '';
  render(<UrlErrorToast />);
  expect(toast.error).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it('says why Steam shared no games after connecting, with a way to the setting', () => {
  query = 'error=steam_private';
  render(<UrlErrorToast />);

  expect(toast.error).toHaveBeenCalledTimes(1);
  const [title, options] = jest.mocked(toast.error).mock.calls[0] as [
    string,
    { id: string; description: ReactNode },
  ];
  expect(title).toBe('Steam sent back no games');
  expect(options.id).toBe('steam-private');

  // The toast's text, as it would be shown.
  const { container } = render(<div>{options.description}</div>);
  expect(container).toHaveTextContent(/game details are private.*Game details.*Public/);
  const link = screen.getByRole('link', { name: "Open Steam's privacy settings" });
  expect(link).toHaveAttribute('href', STEAM_PRIVACY_URL);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(replace).toHaveBeenCalledWith('/home', { scroll: false });
});

describe('good news from an email link', () => {
  it('says the email is changed, then takes the notice out of the address', () => {
    query = 'notice=email-changed';
    render(<UrlErrorToast />);
    expect(toast.success).toHaveBeenCalledWith('Your email is changed', { id: 'url-notice' });
    expect(toast.error).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/home', { scroll: false });
  });

  it('says to open the other link when one of two is confirmed', () => {
    query = 'notice=email-confirm-other';
    render(<UrlErrorToast />);
    expect(toast.success).toHaveBeenCalledWith('One link confirmed', {
      id: 'url-notice',
      description: 'Open the one we sent to your other address to finish changing your email.',
    });
  });

  it('says nothing for a notice it does not know, but still tidies the address', () => {
    query = 'notice=something-else&tab=1';
    render(<UrlErrorToast />);
    expect(toast.success).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/home?tab=1', { scroll: false });
  });
});
