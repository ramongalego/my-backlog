'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cleanUsername } from '@/lib/account/username';
import { ProfilePageSkeleton } from './Skeleton';

/**
 * The page is the player's own or someone else's, and the two aren't quite the
 * same shape. The session is already here (the layout reads it), so the right
 * one is drawn from the start instead of one giving way to the other.
 */
export default function ProfileLoading() {
  const { username } = useParams<{ username: string }>();
  const { profile } = useAuth();
  const own = !!profile?.username && profile.username === cleanUsername(username ?? '');
  return <ProfilePageSkeleton visitor={!own} />;
}
