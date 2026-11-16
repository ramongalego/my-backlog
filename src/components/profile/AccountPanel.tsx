'use client';

import type { ReactNode } from 'react';
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
 * in use.
 */
export function AccountPanel({
  email,
  pendingEmail,
  steam,
  onConnectSteam,
  onChangeEmail,
  onChangePassword,
}: {
  email: string | null;
  /** The new email, until its confirmation link is opened. */
  pendingEmail?: string | null;
  onChangeEmail: () => void;
  onChangePassword: () => void;
  /** The linked Steam account, or null when there's none. */
  steam: { username: string | null } | null;
  onConnectSteam: () => void;
}) {
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
            !steam && (
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
    </Panel>
  );
}
