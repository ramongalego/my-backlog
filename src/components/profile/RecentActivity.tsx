'use client';

import Link from 'next/link';
import { CoverThumb } from '@/components/games/CoverArt';
import { Rating } from '@/components/games/Rating';
import { consoleOf } from '@/lib/games/consoles';
import { STATUS_STYLE } from '@/lib/games/status-style';
import { activityDay, type ActivityEntry } from '@/lib/account/activity';
import { ProfileSection } from './ProfileSection';
import { ACTIVITY_LIST, ACTIVITY_ROW } from './profile-layout';

/** What happened, in the past tense, or now. */
const WHAT = { playing: 'Playing', finished: 'Finished', dropped: 'Dropped' } as const;

function Row({ entry }: { entry: ActivityEntry }) {
  const { icon: Icon, text } = STATUS_STYLE[entry.kind];
  const platform = consoleOf(entry);
  return (
    <li className={ACTIVITY_ROW}>
      <CoverThumb src={entry.header_image} alt="" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink-100 lg:truncate">{entry.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
          <span className={`inline-flex items-center gap-1 ${text}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {WHAT[entry.kind]}
          </span>{' '}
          {entry.day && (
            <span>
              {entry.kind === 'playing' && 'since '}
              {activityDay(entry.day)}
            </span>
          )}{' '}
          {platform && <span>on {platform}</span>}
        </p>
      </div>
      {entry.rating != null && <Rating rating={entry.rating} className="shrink-0" />}
    </li>
  );
}

/**
 * What the player has been doing: the game they're playing, then what they
 * finished or dropped, newest first. A list, where the favorites above are
 * art, so the two don't read as the same row twice.
 */
export function RecentActivity({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ProfileSection
      id="profile-activity"
      title="Recent activity"
      action={
        entries.length > 0 && (
          <Link
            href="/diary"
            className="-my-1 py-1 text-sm text-ink-400 underline decoration-ink-600 underline-offset-4 transition-colors hover:text-ink-50"
          >
            Diary
          </Link>
        )
      }
    >
      {entries.length > 0 ? (
        <ul className={ACTIVITY_LIST}>
          {entries.map((entry) => (
            <Row key={`${entry.kind}-${entry.id}`} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">
          Nothing yet. The game you start, and the ones you finish or drop, show up here.
        </p>
      )}
    </ProfileSection>
  );
}
