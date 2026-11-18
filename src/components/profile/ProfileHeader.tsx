'use client';

import type { ProfileFigures } from '@/lib/account/figures';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileName } from './ProfileName';
import { FIGURE_CELL, FIGURE_STRIP, PROFILE_HEADER } from './profile-layout';
import type { ApiResult } from '@/lib/client/request';

type Result = ApiResult;

// `short` is the label on the narrowest phones (320px), where four figures
// leave each about 56px.
const FIGURES: { key: keyof ProfileFigures; label: string; short?: string }[] = [
  { key: 'games', label: 'Games' },
  { key: 'finished', label: 'Finished' },
  { key: 'finishedThisYear', label: 'This year' },
  { key: 'hours', label: 'Hours played', short: 'Hours' },
];

/** The figures are one strip parted by hairlines, not a row of tiles. */
export function ProfileHeader({
  name,
  avatar,
  identity,
  memberSince,
  figures,
}: {
  name: string;
  avatar: string | null;
  identity: {
    chosenName: string | null;
    accountName: string;
    hasOwnPicture: boolean;
    rename: (name: string | null) => Promise<Result>;
    uploadPicture: (file: File) => Promise<Result>;
    removePicture: () => Promise<Result>;
  };
  memberSince: string | null;
  figures: ProfileFigures;
}) {
  return (
    <div className={PROFILE_HEADER}>
      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
        <ProfileAvatar
          src={avatar}
          name={name}
          hasOwnPicture={identity.hasOwnPicture}
          onUpload={identity.uploadPicture}
          onRemove={identity.removePicture}
        />
        {/* From `lg` it takes its own width but can still give way to the figures. */}
        <div className="min-w-0 flex-1 lg:flex-initial">
          <ProfileName
            name={name}
            fallback={identity.accountName}
            chosen={identity.chosenName}
            onSave={identity.rename}
            under={
              // Rendered (empty) without a date, so the header keeps its height.
              <p className="mt-1 min-h-5 text-sm text-ink-400">
                {memberSince && `Member since ${memberSince}`}
              </p>
            }
          />
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
