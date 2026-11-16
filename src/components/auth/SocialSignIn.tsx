'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ProviderIcon } from '@/components/auth/ProviderIcon';
import { SIGN_IN_PROVIDERS, type SignInProvider } from '@/lib/account/sign-in';

/**
 * What a site is asked beyond the usual. Discord shows its "wants to access
 * your account" screen on every sign-in unless told not to: with
 * `prompt=none` it shows it the first time only, and after that comes
 * straight back. Google already does.
 */
const ASKS: Partial<Record<SignInProvider, Record<string, string>>> = {
  discord: { prompt: 'none' },
};

/** If the other site's page still hasn't come: the buttons can be pressed again. */
const GIVE_UP_MS = 20_000;

/**
 * Signing in with Google or Discord, above the email form in the sign-in and
 * sign-up dialogs: no password to make. A press leaves for that site's page,
 * in the same tab, and comes back through /auth/callback, signed in. Someone
 * new gets an account; someone whose email already has one is signed in to
 * that one (Supabase links the two).
 *
 * The other site's page takes a moment to arrive, so the pressed button's
 * mark turns into a spinner until it does, and both are marked busy, not
 * disabled: the focus stays where it was.
 */
export function SocialSignIn() {
  const [leavingFor, setLeavingFor] = useState<SignInProvider | null>(null);
  const [failed, setFailed] = useState(false);
  // A press on its way. The buttons are marked busy from the next redraw; this
  // stops a second press before then from starting again.
  const leaving = useRef(false);
  const giveUp = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stay = () => {
    clearTimeout(giveUp.current);
    leaving.current = false;
    setLeavingFor(null);
  };

  useEffect(() => {
    // Back from the other site with the browser's Back button, the page is
    // shown again as it was left, still saying it's leaving: it isn't any more.
    const shownAgain = (event: PageTransitionEvent) => {
      if (event.persisted) stay();
    };
    window.addEventListener('pageshow', shownAgain);
    return () => {
      window.removeEventListener('pageshow', shownAgain);
      clearTimeout(giveUp.current);
    };
  }, []);

  const start = async (provider: SignInProvider) => {
    if (leaving.current) return;
    leaving.current = true;
    setFailed(false);
    setLeavingFor(provider);
    giveUp.current = setTimeout(stay, GIVE_UP_MS);
    let started = false;
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?flow=sign-in&next=/home`,
          queryParams: ASKS[provider],
        },
      });
      started = !error;
    } catch {
      started = false;
    }
    // Started: the browser is on its way there, and the button stays busy.
    if (started) return;
    stay();
    setFailed(true);
  };

  return (
    <div className="space-y-3">
      {SIGN_IN_PROVIDERS.map(({ id, name }) => (
        <Button
          key={id}
          type="button"
          variant="secondary"
          onClick={() => start(id)}
          aria-disabled={leavingFor !== null || undefined}
          aria-busy={leavingFor === id || undefined}
          className="w-full cursor-pointer gap-2.5 aria-disabled:cursor-default"
        >
          {leavingFor === id ? (
            <Loader2
              className="h-4.5 w-4.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ProviderIcon provider={id} className="h-4.5 w-4.5" />
          )}
          <span>Continue with {name}</span>
        </Button>
      ))}
      {failed && (
        <p role="alert" className="text-sm text-rose-400">
          Couldn&apos;t start signing in. Please try again.
        </p>
      )}
      <div className="flex items-center gap-3 pt-1">
        <span className="h-px flex-1 bg-ink-800" />
        <span className="text-xs text-ink-500">or</span>
        <span className="h-px flex-1 bg-ink-800" />
      </div>
    </div>
  );
}
