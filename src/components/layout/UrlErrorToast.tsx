'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { steamPrivateToast } from '@/components/sync/steam-private-toast';

// Error codes set by the Steam link callback and the auth callback (email links, Google and Discord).
const MESSAGES: Record<string, string> = {
  invalid_state: 'Your Steam sign-in expired. Please try connecting again.',
  steam_auth_failed: 'Steam sign-in failed. Please try again.',
  invalid_steam_id: 'Steam sign-in failed. Please try again.',
  server_config: 'Connecting Steam is unavailable right now',
  not_authenticated: 'Please sign in before connecting Steam',
  steam_link_limited: 'Too many tries to connect Steam. Please wait a while and try again.',
  steam_api_failed: "Couldn't reach Steam. Please try again in a moment.",
  profile_update_failed: "Couldn't import your Steam library. Please try again.",
  games_insert_failed: "Couldn't import your Steam library. Please try again.",
  invalid_link: 'That link is invalid or has expired',
  // Back from Google or Discord without being signed in.
  sign_in_failed: "Couldn't sign you in. Please try again.",
  sign_in_unverified: "That account's email isn't verified. Verify it there, then sign in again.",
};

// Good news set by the auth email callback (a link confirming a new email).
const NOTICES: Record<string, () => void> = {
  'email-changed': () => toast.success('Your email is changed', { id: 'url-notice' }),
  // The link was opened where nobody is signed in (another device or browser).
  'email-changed-sign-in': () =>
    toast.success('Your email is changed', {
      id: 'url-notice',
      description: 'Sign in with your new address',
    }),
  'email-confirm-other': () =>
    toast.success('One link confirmed', {
      id: 'url-notice',
      description: 'Open the one we sent to your other address to finish changing your email.',
    }),
};

/**
 * Shows `?error=<code>` redirects as a toast (and `?notice=<code>`, the
 * good news), then removes the param from the URL.
 */
export function UrlErrorToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const code = searchParams.get('error');
  const notice = searchParams.get('notice');

  useEffect(() => {
    if (!code && !notice) return;
    if (code === 'steam_private') {
      // Steam connected but shared no games: its own toast, with what to change.
      steamPrivateToast();
    } else if (code) {
      // Fixed id so a re-run of this effect can't stack a duplicate toast.
      // hasOwn: the code comes from the address, and "__proto__" is not a message.
      const message = Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : null;
      toast.error(message ?? 'Something went wrong. Please try again.', {
        id: `url-error-${code}`,
      });
    }
    if (notice && Object.hasOwn(NOTICES, notice)) NOTICES[notice]();
    const params = new URLSearchParams(searchParams);
    params.delete('error');
    params.delete('notice');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [code, notice, searchParams, pathname, router]);

  return null;
}
