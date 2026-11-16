'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SteamIcon } from '@/components/ui/SteamIcon';
import { SectionLabel } from '@/components/layout/Page';

function Row({
  label,
  value,
  note,
  action,
}: {
  label: string;
  value: ReactNode;
  /** A line under the value. */
  note?: ReactNode;
  action?: ReactNode;
}) {
  return (
    // A list, not a description list: a row also holds its button, which a
    // description list has no place for.
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-500">{label}</p>
        <p className="mt-0.5 truncate text-sm text-ink-100">{value}</p>
        {note && <p className="mt-0.5 truncate text-xs text-ink-400">{note}</p>}
      </div>
      {action}
    </li>
  );
}

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
 * in use. Steam is connected or disconnected here. Deleting the account is
 * behind "More options", so it isn't always on show.
 */
export function AccountPanel({
  email,
  pendingEmail,
  steam,
  onConnectSteam,
  onDisconnectSteam,
  onChangeEmail,
  onChangePassword,
  onDeleteAccount,
}: {
  onDisconnectSteam: () => void;
  onDeleteAccount: () => void;
  email: string | null;
  /** The new email, until its confirmation link is opened. */
  pendingEmail?: string | null;
  onChangeEmail: () => void;
  onChangePassword: () => void;
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
        <Row
          label="Email"
          value={email ?? 'None'}
          note={pendingEmail && <>Changing to {pendingEmail}, once confirmed</>}
          action={<Change what="email" onClick={onChangeEmail} />}
        />
        <Row
          label="Password"
          value={
            <>
              <span aria-hidden="true">••••••••</span>
              <span className="sr-only">Hidden</span>
            </>
          }
          action={<Change what="password" onClick={onChangePassword} />}
        />
        <Row
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
              <Button
                variant="secondary"
                size="sm"
                onClick={onConnectSteam}
                className="shrink-0 cursor-pointer"
              >
                <SteamIcon className="h-4 w-4" />
                Connect
              </Button>
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
      <div id={moreId} hidden={!moreOpen} className="mt-3 border-t border-ink-800 pt-3">
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
