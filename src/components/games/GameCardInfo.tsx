import { Clock, ExternalLink, History, ThumbsUp } from 'lucide-react';
import { Tooltip, TooltipText } from '@/components/ui/Tooltip';
import { steamReviewLabel } from '@/lib/steam/review-label';
import { formatLastPlayed } from '@/lib/games/last-played';
import { SteamDeckBadge } from './SteamDeckBadge';

/**
 * Steam's review score the way Steam shows it: percent positive with a
 * thumbs-up (not a star, which the app uses for your own rating). Steam's
 * label and the review count are in the tooltip.
 */
export function SteamScore({
  score,
  count,
  iconClassName = 'w-3 h-3',
}: {
  score: number;
  count?: number | null;
  iconClassName?: string;
}) {
  const label = count != null ? steamReviewLabel(score, count) : null;
  const detail =
    count != null
      ? `${score}% of ${count.toLocaleString('en-US')} Steam review${count === 1 ? '' : 's'} are positive`
      : `${score}% of Steam reviews are positive`;
  return (
    <Tooltip
      content={
        label ? <TooltipText title={label} detail={detail} /> : <TooltipText title={detail} />
      }
    >
      <ThumbsUp className={iconClassName} aria-hidden="true" />
      <span>{score}%</span>
      <span className="sr-only"> on Steam</span>
    </Tooltip>
  );
}

/** HowLongToBeat's main story time, with what the number means in the tooltip. */
export function TimeToBeat({
  hours,
  iconClassName = 'w-3 h-3',
}: {
  hours: number;
  iconClassName?: string;
}) {
  return (
    <Tooltip content={<TooltipText title="Time to beat: Main Story" detail="From HowLongToBeat" />}>
      <Clock className={iconClassName} aria-hidden="true" />
      <span>{hours}h</span>
      <span className="sr-only"> to beat the main story</span>
    </Tooltip>
  );
}

/**
 * Hours played on Steam, with when you last played in the tooltip. Used
 * wherever a game shows its playtime, so it reads the same everywhere.
 * `compact` is the meta-row form, icon and hours like its neighbours, so a
 * row fits on narrow cards; elsewhere it reads "5h played".
 */
export function Playtime({
  minutes,
  lastPlayedAt,
  compact = false,
  iconClassName = 'w-3 h-3',
  className = '',
}: {
  minutes: number;
  lastPlayedAt?: string | null;
  compact?: boolean;
  iconClassName?: string;
  className?: string;
}) {
  const hours = Math.round(minutes / 60);
  const lastPlayed = formatLastPlayed(lastPlayedAt);
  return (
    <Tooltip
      className={className}
      content={
        lastPlayed ? (
          <TooltipText title={lastPlayed} detail={`${hours}h played on Steam`} />
        ) : (
          <TooltipText title={`${hours}h played`} detail="Playtime from Steam" />
        )
      }
    >
      {compact ? (
        <>
          <History className={iconClassName} aria-hidden="true" />
          <span>{hours}h</span>
          <span className="sr-only"> played</span>
        </>
      ) : (
        <span>{hours}h played</span>
      )}
    </Tooltip>
  );
}

interface GameMetaRowProps {
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  playtimeMinutes?: number;
  lastPlayedAt?: string | null;
  deckCompat?: number | null;
  hidePlaytimeOnMobile?: boolean;
}

export function GameMetaRow({
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  playtimeMinutes = 0,
  lastPlayedAt,
  deckCompat,
  hidePlaytimeOnMobile,
}: GameMetaRowProps) {
  if (!mainStoryHours && !steamReviewScore && playtimeMinutes < 60 && !deckCompat) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-500 whitespace-nowrap">
      {mainStoryHours ? <TimeToBeat hours={mainStoryHours} /> : null}
      {steamReviewScore ? <SteamScore score={steamReviewScore} count={steamReviewCount} /> : null}
      {playtimeMinutes >= 60 ? (
        <Playtime
          compact
          minutes={playtimeMinutes}
          lastPlayedAt={lastPlayedAt}
          className={hidePlaytimeOnMobile ? 'max-sm:hidden' : ''}
        />
      ) : null}
      <SteamDeckBadge deckCompat={deckCompat} />
    </div>
  );
}

interface GameCardInfoProps {
  appId: number;
  name: string;
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  playtimeMinutes?: number;
  lastPlayedAt?: string | null;
  deckCompat?: number | null;
}

export function GameCardInfo({
  appId,
  name,
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  playtimeMinutes = 0,
  lastPlayedAt,
  deckCompat,
}: GameCardInfoProps) {
  return (
    <>
      <a
        href={`https://store.steampowered.com/app/${appId}/`}
        target="_blank"
        rel="noopener noreferrer"
        title={name}
        className="group/title flex items-center gap-1 text-ink-100 font-medium hover:text-ink-50 transition-colors cursor-pointer"
      >
        <span className="truncate min-w-0">{name}</span>
        <ExternalLink
          className="w-3 h-3 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity mb-px"
          aria-hidden="true"
        />
      </a>
      <div className="mt-1">
        <GameMetaRow
          mainStoryHours={mainStoryHours}
          steamReviewScore={steamReviewScore}
          steamReviewCount={steamReviewCount}
          playtimeMinutes={playtimeMinutes}
          lastPlayedAt={lastPlayedAt}
          deckCompat={deckCompat}
        />
      </div>
    </>
  );
}
