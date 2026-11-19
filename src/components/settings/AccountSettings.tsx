'use client';

import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ConnectSteamButton } from '@/components/ui/ConnectSteamButton';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { SectionLabel } from '@/components/layout/Page';
import { AccountRow } from '@/components/settings/AccountRow';
import { ExportDataMenu } from '@/components/settings/ExportDataMenu';
import { NoPasswordRow } from '@/components/settings/NoPasswordRow';
import { PictureRow } from '@/components/settings/PictureRow';
import { SETTINGS_COLUMNS, SETTINGS_STACK } from '@/components/settings/settings-layout';
import type { ExportFormat } from '@/lib/account/export';
import { publicProfilePath } from '@/lib/account/public-profile';
import type { SignInProvider } from '@/lib/account/sign-in';
import type { ApiResult } from '@/lib/client/request';

const ROWS = 'mt-1 divide-y divide-ink-800';

/** The site's address as people share it, for saying where a profile is. */
const SITE = 'mybacklog.co';

const VISIBILITY = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
] as const;

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

/** A sentence saying what the button beside it does. */
function ActionRow({ children, action }: { children: string; action: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <p className="min-w-0 text-sm text-ink-300">{children}</p>
      {action}
    </li>
  );
}

/**
 * The Settings page: what the profile shows of the player (and who can see
 * it), the account, its Steam link and its data. An account made with Google
 * or Discord has no password, so its email can't change until it sets one:
 * the password confirms it.
 */
export function AccountSettings({
  profile,
  username,
  onChangeUsername,
  email,
  pendingEmail,
  memberSince,
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
  profile: {
    /** The name the profile goes by. */
    name: string;
    avatar: string | null;
    /** A picture they uploaded, which can be taken off. */
    hasOwnPicture: boolean;
    onChangeName: () => void;
    onUploadPicture: (file: File) => Promise<ApiResult>;
    onRemovePicture: () => Promise<ApiResult>;
    /** Null until the profile is read: the row waits for it. */
    isPrivate: boolean | null;
    onSetPrivate: (isPrivate: boolean) => void;
  };
  onDisconnectSteam: () => void;
  onDeleteAccount: () => void;
  /** Left out when there are no games to copy, which hides Export data. */
  onDownloadData?: (format: ExportFormat) => Promise<ApiResult>;
  /** Null until the profile is read: the row waits for it. */
  username: string | null;
  onChangeUsername: () => void;
  email: string | null;
  /** The new email, until its confirmation link is opened. */
  pendingEmail?: string | null;
  /** "January 2026": when the account was made. Left out when that isn't known. */
  memberSince?: string | null;
  signIn: { hasPassword: boolean; providers: readonly SignInProvider[] };
  onChangeEmail: () => void;
  onChangePassword: () => void;
  /** Emails a link that sets a password, for an account with none; whether it was sent. */
  onSetPassword: () => Promise<boolean>;
  /** The linked Steam account, or null when there's none. */
  steam: { username: string | null } | null;
  onConnectSteam: () => void;
}) {
  return (
    <div className={SETTINGS_COLUMNS}>
      <div className={SETTINGS_STACK}>
        <Panel>
          <SectionLabel>Profile</SectionLabel>
          <ul className={ROWS}>
            <PictureRow
              src={profile.avatar}
              name={profile.name}
              hasOwnPicture={profile.hasOwnPicture}
              onUpload={profile.onUploadPicture}
              onRemove={profile.onRemovePicture}
            />
            <AccountRow
              label="Display name"
              value={profile.name}
              action={<Change what="display name" onClick={profile.onChangeName} />}
            />
            {username && (
              <AccountRow
                label="Username"
                value={username}
                action={<Change what="username" onClick={onChangeUsername} />}
              />
            )}
            {profile.isPrivate != null && (
              <AccountRow
                label="Who can see your profile"
                value={profile.isPrivate ? 'Only you' : 'Anyone with the link'}
                // Where it is, while there's somewhere for a link to lead.
                note={!profile.isPrivate && username && `${SITE}${publicProfilePath(username)}`}
                wideAction
                action={
                  <ToggleGroup
                    variant="segmented"
                    label="Who can see your profile"
                    options={VISIBILITY}
                    value={profile.isPrivate ? 'private' : 'public'}
                    onChange={(value) => profile.onSetPrivate(value === 'private')}
                    className="shrink-0"
                  />
                }
              />
            )}
          </ul>
        </Panel>
      </div>

      <div className={SETTINGS_STACK}>
        <Panel>
          <SectionLabel>Account</SectionLabel>
          <ul className={ROWS}>
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
              <NoPasswordRow
                email={email}
                providers={signIn.providers}
                onSendLink={onSetPassword}
              />
            )}
            {memberSince && <AccountRow label="Member since" value={memberSince} />}
          </ul>
        </Panel>

        <Panel>
          <SectionLabel>Connections</SectionLabel>
          <ul className={ROWS}>
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
        </Panel>

        <Panel>
          <SectionLabel>Your data</SectionLabel>
          <ul className={ROWS}>
            {onDownloadData && (
              <ActionRow action={<ExportDataMenu onDownload={onDownloadData} />}>
                Download a copy of your data
              </ActionRow>
            )}
            <ActionRow
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDeleteAccount}
                  className="shrink-0 cursor-pointer text-rose-400 hover:text-rose-300"
                >
                  Delete account
                </Button>
              }
            >
              Delete your account and everything in it
            </ActionRow>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
