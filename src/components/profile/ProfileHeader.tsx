import type { ReactNode } from 'react';
import type { ProfileFigures } from '@/lib/account/figures';
import { ProfileFigureStrip } from './ProfileFigureStrip';
import { ProfilePicture } from './ProfilePicture';
import { PROFILE_BYLINE, PROFILE_HEADER } from './profile-layout';

/**
 * Who the profile is: the same header on the player's own Profile and on the
 * page other people see. Nothing here is changed in place: the name, the
 * picture and the username are changed on Settings, which is where `action`
 * leads on the player's own.
 */
export function ProfileHeader({
  name,
  username,
  avatar,
  figures,
  action,
}: {
  name: string;
  /** Null until the profile is read: the line waits for it. */
  username: string | null;
  avatar: string | null;
  figures: ProfileFigures;
  /** Beside the name: Edit profile, on the player's own Profile only. */
  action?: ReactNode;
}) {
  return (
    <div className={PROFILE_HEADER}>
      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
        <div className="shrink-0">
          {/* Keyed by the picture: a new one gets its own chance to load. */}
          <ProfilePicture key={avatar} src={avatar} name={name} />
        </div>
        {/* From `lg` it takes its own width but can still give way to the figures. */}
        <div className="min-w-0 flex-1 lg:flex-initial">
          {/* Wraps below `lg`, as names do; beside the figures it's cut instead. */}
          <h1 className="min-w-0 text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-ink-50 [overflow-wrap:anywhere] lg:truncate">
            {name}
          </h1>
          {/* Rendered (empty) until it is known, so the header keeps its height. */}
          <p className={PROFILE_BYLINE}>{username && `@${username}`}</p>
        </div>
        {action}
      </div>

      <ProfileFigureStrip figures={figures} />
    </div>
  );
}
