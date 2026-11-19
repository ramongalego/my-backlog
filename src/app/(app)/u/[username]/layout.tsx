import { notFound } from 'next/navigation';
import { cleanUsername } from '@/lib/account/username';
import { ownUsername } from '@/lib/server/own-username';
import { publicProfileExists } from '@/lib/server/public-profile';

/**
 * Whether there is a profile at this address is settled here, above the page's
 * loading skeleton: an address nobody has (or a private profile, which answers
 * the same) is a real 404 from the start, not a skeleton that gives way to one.
 * The page reuses both reads, so asking here costs nothing more.
 */
export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  // The player's own is theirs to see, private or not.
  const isOwn = (await ownUsername()) === cleanUsername(username);
  if (!isOwn && !(await publicProfileExists(username))) notFound();
  return children;
}
