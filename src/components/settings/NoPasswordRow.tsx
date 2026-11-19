'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AccountRow } from '@/components/settings/AccountRow';
import { providerNames, type SignInProvider } from '@/lib/account/sign-in';

/**
 * For an account made with Google or Discord. Set password emails the same link
 * Forgot password sends: with no password, the inbox is what proves it's them.
 */
export function NoPasswordRow({
  email,
  providers,
  onSendLink,
}: {
  /** Where the link goes. */
  email: string | null;
  providers: readonly SignInProvider[];
  /** Emails the link; whether it was sent. */
  onSendLink: () => Promise<boolean>;
}) {
  const [link, setLink] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  // A request on its way. The button is marked busy from the next redraw; this
  // stops a second press before then from sending again.
  const sending = useRef(false);
  const status = useRef<HTMLSpanElement>(null);
  const names = providerNames(providers);

  const send = async () => {
    if (sending.current) return;
    sending.current = true;
    setLink('sending');
    try {
      const sent = await onSendLink();
      // The button goes when the link is sent: focus moves to the line that
      // says so (which reads it out) rather than falling back to the page.
      if (sent) status.current?.focus();
      setLink(sent ? 'sent' : 'failed');
    } finally {
      sending.current = false;
    }
  };

  return (
    <AccountRow
      label="Password"
      value="Not set"
      note={
        // Always here, so a change to what it says is read out.
        <span ref={status} tabIndex={-1} role="status" className="outline-none">
          {link === 'sent' ? (
            <>We emailed a link to {email}. Open it to choose a password.</>
          ) : link === 'failed' ? (
            <span className="text-rose-400">Couldn&apos;t send the link. Please try again.</span>
          ) : (
            names && <>You sign in with {names}</>
          )}
        </span>
      }
      action={
        email &&
        link !== 'sent' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={send}
            // Not `disabled`: it has the focus while it sends (the ref guards it).
            aria-disabled={link === 'sending' || undefined}
            className="shrink-0 cursor-pointer aria-disabled:cursor-default"
          >
            {link === 'sending' ? 'Sending…' : 'Set password'}
          </Button>
        )
      }
    />
  );
}
