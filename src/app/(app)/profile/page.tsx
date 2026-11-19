import { redirect } from 'next/navigation';
import { publicProfilePath } from '@/lib/account/public-profile';
import { ownUsername } from '@/lib/server/own-username';

/**
 * A player's profile has one address, /u/<username>, which shows them their own
 * with everything on it. This one only knows who is asking: for a link that
 * can't know the username (an old bookmark, the menu before the session loads).
 * No loading.tsx, so it answers with a redirect rather than a page.
 */
export default async function ProfilePage() {
  const username = await ownUsername();
  // Signed-out visitors are turned away before this (a protected route), and
  // every profile has a username: Home is only for a profile that can't be read.
  redirect(username ? publicProfilePath(username) : '/home');
}
