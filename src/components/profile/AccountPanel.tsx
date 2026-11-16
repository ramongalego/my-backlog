'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ConnectSteamButton } from '@/components/ui/ConnectSteamButton';
import { SectionLabel } from '@/components/layout/Page';
import { AccountRow } from '@/components/profile/AccountRow';
import { ExportDataMenu } from '@/components/profile/ExportDataMenu';
import { NoPasswordRow } from '@/components/profile/NoPasswordRow';
import type { ExportFormat } from '@/lib/account/export';
import type { SignInProvider } from '@/lib/account/sign-in';
import type { ApiResult } from '@/lib/client/request';

/** Opens the dialog that changes a setting. */
const Change = ({ what, onClick }: { what: string; onClick: () => void }) => (
  <Button
    variant="ghost"
    size="sm"
    onClick={onClick}
    // "Change" is what's shown; the setting is said for a screen reader.
    aria-label={`Change ${what}`}
    className="shrink-0 cursor-pointer"
  >
    Change
  </Button>
);

/**
 * How the player signs in, and Steam: the private side of the profile, which
 * only they will see. Email and password are changed from here, each in a
 * dialog; an email waiting for its confirmation link is shown under the one
 * in use. An account made with Google or Discord has no password: its
 * Password row says so and offers Set password (`NoPasswordRow`), and its
 * email can't be changed until it has one, since the password is what
 * confirms that. Steam is connected or disconnected here. Export data (a menu of
 * the two files a copy of your data comes as) and Delete account are behind
 * "More options", so they aren't always on show.
 */
export function AccountPanel({
  email,
  pendingEmail,
  signIn,
  onSetPassword,
  steam,
  onConnectSteam,
  onDisconnectSteam,
  onChangeEmail,
  onChangePassword,
  onDownloadData,
  onDeleteAccount,
}: {
  onDisconnectSteam: () => void;
  onDeleteAccount: () => void;
  /**
   * Fetches a copy of the player's data, as a file the browser saves. Left
   * out when there's nothing to copy (no games): Export data isn't shown.
   */
  onDownloadData?: (format: ExportFormat) => Promise<ApiResult>;
  email: string | null;
  /** The new email, until its confirmation link is opened. */
  pendingEmail?: string | null;
  /** How the account signs in: with a password, with Google or Discord, or both. */
  signIn: { hasPassword: boolean; providers: readonly SignInProvider[] };
  onChangeEmail: () => void;
  onChangePassword: () => void;
  /** Emails a link that sets a password, for an account with none; whether it was sent. */
  onSetPassword: () => Promise<boolean>;
  /** The linked Steam account, or null when there's none. */
  steam: { username: string | null } | null;
  onConnectSteam: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();
  return (
    <Panel>
      <SectionLabel>Account</SectionLabel>
      <ul className="mt-1 divide-y divide-ink-800">
        <AccountRow
          label="Email"
          value={email ?? 'None'}
          note={
            pendingEmail ? (
              <>Changing to {pendingEmail}, once confirmed</>
            ) : (
              !signIn.hasPassword && 'Set a password to change your email'
            )
          }
          action={signIn.hasPassword && <Change what="email" onClick={onChangeEmail} />}
        />
        {signIn.hasPassword ? (
          <AccountRow
            label="Password"
            value={
              <>
                <span aria-hidden="true">••••••••</span>
                <span className="sr-only">Hidden</span>
              </>
            }
            action={<Change what="password" onClick={onChangePassword} />}
          />
        ) : (
          <NoPasswordRow email={email} providers={signIn.providers} onSendLink={onSetPassword} />
        )}
        <AccountRow
          label="Steam"
          value={
            steam
              ? steam.username
                ? `Connected as ${steam.username}`
                : 'Connected'
              : 'Not connected'
          }
          action={
            steam ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDisconnectSteam}
                // "Disconnect" is what's shown; what from is said for a screen reader.
                aria-label="Disconnect Steam"
                className="shrink-0 cursor-pointer"
              >
                Disconnect
              </Button>
            ) : (
              // "Connect" is what's shown: the row already says Steam.
              <ConnectSteamButton size="sm" className="shrink-0" onClick={onConnectSteam}>
                Connect
              </ConnectSteamButton>
            )
          }
        />
      </ul>
      {/* Rarely wanted, so out of the way until asked for. */}
      <button
        type="button"
        onClick={() => setMoreOpen((was) => !was)}
        aria-expanded={moreOpen}
        aria-controls={moreId}
        // py-1 -my-1: about 24px to hit without moving anything.
        className="-my-1 mt-2 flex cursor-pointer items-center gap-1 py-1 text-xs font-medium text-ink-500 transition-colors hover:text-ink-200"
      >
        More options
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${moreOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div id={moreId} hidden={!moreOpen} className="mt-3 space-y-3 border-t border-ink-800 pt-3">
        {onDownloadData && (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-ink-400">Download a copy of your data</p>
            <ExportDataMenu onDownload={onDownloadData} />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-ink-400">Delete your account and everything in it</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteAccount}
            className="shrink-0 cursor-pointer text-rose-400 hover:text-rose-300"
          >
            Delete account
          </Button>
        </div>
      </div>
    </Panel>
  );
}
