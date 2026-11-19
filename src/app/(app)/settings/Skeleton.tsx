import { PageSkeleton, PanelSkeleton, Skeleton } from '@/components/layout/Skeleton';
import { panelPadding } from '@/components/ui/Panel';
import { AVATAR_SIZE } from '@/components/profile/profile-layout';
import { SETTINGS_COLUMNS, SETTINGS_STACK } from '@/components/settings/settings-layout';

/** Mirrors a panel of AccountSettings: its label, then rows with a button at the end. */
function Section({
  label,
  rows,
  sentences,
  avatar,
}: {
  label: string;
  rows: number;
  sentences?: boolean;
  /** The first row is the avatar, at the size the profile draws it. */
  avatar?: boolean;
}) {
  return (
    <PanelSkeleton className={panelPadding()}>
      <Skeleton className={`h-5 ${label}`} />
      <div className="mt-1 divide-y divide-ink-800">
        {avatar && (
          <div className="flex items-center justify-between gap-3 py-3">
            <div>
              <Skeleton className="h-3 w-12" />
              <Skeleton className={`mt-2.5 ${AVATAR_SIZE} rounded-xl`} />
            </div>
            <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
          </div>
        )}
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-3">
            {sentences ? (
              <Skeleton className="h-4 w-52 max-w-[60%]" />
            ) : (
              <div>
                <Skeleton className="h-3 w-14" />
                <Skeleton className="mt-2 h-4 w-40" />
              </div>
            )}
            <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </PanelSkeleton>
  );
}

export function SettingsPageSkeleton() {
  return (
    <PageSkeleton>
      {/* The title alone: Settings has no line under it. */}
      <div className="mb-8">
        <Skeleton className="h-8 w-32 sm:h-9" />
      </div>
      <div className={SETTINGS_COLUMNS}>
        <div className={SETTINGS_STACK}>
          {/* Profile: avatar, display name, username, who can see it. */}
          <Section label="w-16" rows={3} avatar />
        </div>
        <div className={SETTINGS_STACK}>
          {/* Account: email, password, member since. */}
          <Section label="w-20" rows={3} />
          <Section label="w-28" rows={1} />
          <Section label="w-20" rows={2} sentences />
        </div>
      </div>
    </PageSkeleton>
  );
}
