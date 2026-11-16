'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SteamIcon } from '@/components/ui/SteamIcon';
import { SectionLabel } from '@/components/layout/Page';

function Row({ label, value, action }: { label: string; value: ReactNode; action?: ReactNode }) {
  return (
    // A list, not a description list: a row also holds its button, which a
    // description list has no place for.
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-500">{label}</p>
        <p className="mt-0.5 truncate text-sm text-ink-100">{value}</p>
      </div>
      {action}
    </li>
  );
}

/** A setting that can't be changed yet: its button is there, disabled. */
const ChangeLater = () => (
  <Button variant="ghost" size="sm" disabled className="shrink-0">
    Change
  </Button>
);

/**
 * How the player signs in, and Steam: the private side of the profile, which
 * only they will see. Email and password are shown where they will be changed.
 */
export function AccountPanel({
  email,
  steam,
  onConnectSteam,
}: {
  email: string | null;
  /** The linked Steam account, or null when there's none. */
  steam: { username: string | null } | null;
  onConnectSteam: () => void;
}) {
  return (
    <Panel>
      <SectionLabel>Account</SectionLabel>
      <ul className="mt-1 divide-y divide-ink-800">
        <Row label="Email" value={email ?? 'None'} action={<ChangeLater />} />
        <Row
          label="Password"
          value={
            <>
              <span aria-hidden="true">••••••••</span>
              <span className="sr-only">Hidden</span>
            </>
          }
          action={<ChangeLater />}
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
      <p className="mt-2 text-xs text-ink-500">Changing your email and password comes next</p>
    </Panel>
  );
}
