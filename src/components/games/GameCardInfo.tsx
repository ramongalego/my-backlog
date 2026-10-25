import { Clock, ExternalLink, ThumbsUp } from 'lucide-react';
import { Tooltip, TooltipText } from '@/components/ui/Tooltip';
import { steamReviewLabel } from '@/lib/steam/review-label';
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

interface GameMetaRowProps {
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  playtimeMinutes?: number;
  deckCompat?: number | null;
  hidePlaytimeOnMobile?: boolean;
}

export function GameMetaRow({
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  playtimeMinutes = 0,
  deckCompat,
  hidePlaytimeOnMobile,
}: GameMetaRowProps) {
  if (!mainStoryHours && !steamReviewScore && playtimeMinutes < 60 && !deckCompat) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
      {mainStoryHours ? <TimeToBeat hours={mainStoryHours} /> : null}
      {steamReviewScore ? <SteamScore score={steamReviewScore} count={steamReviewCount} /> : null}
      {playtimeMinutes >= 60 ? (
        <span className={`text-ink-500${hidePlaytimeOnMobile ? ' hidden sm:inline' : ''}`}>
          {Math.round(playtimeMinutes / 60)}h played
        </span>
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
  deckCompat?: number | null;
}

export function GameCardInfo({
  appId,
  name,
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  playtimeMinutes = 0,
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
          deckCompat={deckCompat}
        />
      </div>
    </>
  );
}
