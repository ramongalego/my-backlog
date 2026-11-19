'use client';

import { useState } from 'react';
import { Page, PageHeader } from '@/components/layout/Page';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { ChangeEmailDialog } from '@/components/settings/ChangeEmailDialog';
import { ChangeNameDialog } from '@/components/settings/ChangeNameDialog';
import { ChangePasswordDialog } from '@/components/settings/ChangePasswordDialog';
import { ChangeUsernameDialog } from '@/components/settings/ChangeUsernameDialog';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import { DisconnectSteamDialog } from '@/components/settings/DisconnectSteamDialog';
import { useConnectSteam } from '@/hooks/useConnectSteam';
import { useSettingsPage } from '@/hooks/useSettingsPage';

export default function SettingsView() {
  const { connect: connectSteam } = useConnectSteam();
  const settings = useSettingsPage();
  const [changing, setChanging] = useState<
    'name' | 'username' | 'email' | 'password' | 'delete-account' | 'disconnect-steam' | null
  >(null);
  const close = () => setChanging(null);

  return (
    <Page
      overlay={
        <>
          {changing === 'name' && (
            <ChangeNameDialog
              chosen={settings.profile.chosenName}
              accountName={settings.profile.accountName}
              onSubmit={settings.profile.rename}
              onClose={close}
            />
          )}
          {changing === 'username' && settings.username && (
            <ChangeUsernameDialog
              username={settings.username}
              onSubmit={settings.changeUsername}
              onClose={close}
            />
          )}
          {changing === 'email' && settings.email && (
            <ChangeEmailDialog
              email={settings.email}
              onSubmit={settings.changeEmail}
              onClose={close}
            />
          )}
          {changing === 'password' && settings.email && (
            <ChangePasswordDialog
              email={settings.email}
              onSubmit={settings.changePassword}
              onSendReset={settings.sendPasswordReset}
              onClose={close}
            />
          )}
          {changing === 'delete-account' && (
            <DeleteAccountDialog
              hasPassword={settings.signIn.hasPassword}
              onDelete={settings.deleteAccount}
              onDownloadData={settings.downloadData}
              onClose={close}
            />
          )}
          {changing === 'disconnect-steam' && (
            <DisconnectSteamDialog
              steamGames={settings.steamGames}
              onDisconnect={settings.disconnectSteam}
              onDownloadData={settings.downloadData}
              onClose={close}
            />
          )}
        </>
      }
    >
      <PageHeader title="Settings" />
      <AccountSettings
        profile={{
          name: settings.profile.name,
          avatar: settings.profile.avatar,
          hasOwnPicture: settings.profile.hasOwnPicture,
          onChangeName: () => setChanging('name'),
          onUploadPicture: settings.profile.uploadPicture,
          onRemovePicture: settings.profile.removePicture,
          isPrivate: settings.profile.isPrivate,
          onSetPrivate: settings.profile.setPrivate,
        }}
        ai={{ enabled: settings.ai.enabled, onSetEnabled: settings.ai.setEnabled }}
        username={settings.username}
        onChangeUsername={() => setChanging('username')}
        email={settings.email}
        pendingEmail={settings.pendingEmail}
        memberSince={settings.memberSince}
        signIn={settings.signIn}
        onSetPassword={settings.sendPasswordReset}
        steam={settings.steam}
        onConnectSteam={connectSteam}
        onChangeEmail={() => setChanging('email')}
        onChangePassword={() => setChanging('password')}
        onDisconnectSteam={() => setChanging('disconnect-steam')}
        onDownloadData={settings.downloadData}
        onDeleteAccount={() => setChanging('delete-account')}
      />
    </Page>
  );
}
