'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

// Error codes set by the Steam link callback and the auth email callback.
const MESSAGES: Record<string, string> = {
  invalid_state: 'Your Steam sign-in expired. Please try connecting again.',
  steam_auth_failed: 'Steam sign-in failed. Please try again.',
  invalid_steam_id: 'Steam sign-in failed. Please try again.',
  server_config: 'Connecting Steam is unavailable right now.',
  not_authenticated: 'Please sign in before connecting Steam.',
  steam_api_failed: "Couldn't reach Steam. Please try again in a moment.",
  profile_update_failed: "Couldn't import your Steam library. Please try again.",
  games_insert_failed: "Couldn't import your Steam library. Please try again.",
  invalid_link: 'That link is invalid or has expired.',
};

/** Shows `?error=<code>` redirects as a toast, then removes the param from the URL. */
export function UrlErrorToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const code = searchParams.get('error');

  useEffect(() => {
    if (!code) return;
    // Fixed id so a re-run of this effect can't stack a duplicate toast.
    toast.error(MESSAGES[code] ?? 'Something went wrong. Please try again.', {
      id: `url-error-${code}`,
    });
    const params = new URLSearchParams(searchParams);
    params.delete('error');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [code, searchParams, pathname, router]);

  return null;
}
