'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { initialOf } from '@/lib/account/identity';
import type { ProfileFigures } from '@/lib/account/figures';
import { AVATAR_SIZE, FIGURE_CELL, FIGURE_STRIP, PROFILE_HEADER } from './profile-layout';

/** The player's picture: Steam's when there is one, otherwise their initial. */
function Avatar({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <Image
      src={src}
      // The name is right beside it.
      alt=""
      width={80}
      height={80}
      preload
      className={`${AVATAR_SIZE} shrink-0 rounded-xl bg-ink-800 object-cover`}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`${AVATAR_SIZE} flex shrink-0 items-center justify-center rounded-xl bg-ink-800 text-2xl font-semibold text-ink-300`}
    >
      {initialOf(name)}
    </div>
  );
}

// `short` is the label on the narrowest phones (320px), where four figures
// leave each about 56px.
const FIGURES: { key: keyof ProfileFigures; label: string; short?: string }[] = [
  { key: 'games', label: 'Games' },
  { key: 'finished', label: 'Finished' },
  { key: 'finishedThisYear', label: 'This year' },
  { key: 'hours', label: 'Hours played', short: 'Hours' },
];

/**
 * The top of the Profile page: who it is, and their library in four figures.
 * One strip, parted by hairlines, rather than a row of tiles; it sits right of
 * the name when there's room and under it when there isn't.
 */
export function ProfileHeader({
  name,
  avatar,
  memberSince,
  figures,
}: {
  name: string;
  avatar: string | null;
  memberSince: string | null;
  figures: ProfileFigures;
}) {
  return (
    <div className={PROFILE_HEADER}>
      <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
        <Avatar src={avatar} name={name} />
        {/* On phones the button goes under the name, which then has the row's
            whole width; from `sm` it sits beside it. */}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5 lg:flex-none">
          <div className="min-w-0 max-w-full">
            <h1 className="truncate text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-ink-50">
              {name}
            </h1>
            {/* Rendered (empty) without a date, so the header keeps its height. */}
            <p className="mt-1 min-h-5 text-sm text-ink-400">
              {memberSince && `Member since ${memberSince}`}
            </p>
          </div>
          {/* Avatar, name and bio, once they can be changed. */}
          <Button variant="secondary" size="sm" disabled className="shrink-0">
            Edit profile
          </Button>
        </div>
      </div>

      <dl className={`${FIGURE_STRIP} divide-x divide-ink-800`}>
        {FIGURES.map(({ key, label, short }) => (
          // The figure reads first, its label under it.
          <div key={key} className={`flex min-w-0 flex-col-reverse ${FIGURE_CELL}`}>
            <dt className="mt-0.5 truncate text-xs text-ink-500">
              {short ? (
                <>
                  <span className="min-[360px]:hidden">{short}</span>
                  <span className="max-[359px]:hidden">{label}</span>
                </>
              ) : (
                label
              )}
            </dt>
            <dd className="text-xl sm:text-2xl font-semibold tracking-tight text-ink-50">
              {figures[key].toLocaleString('en-US')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
