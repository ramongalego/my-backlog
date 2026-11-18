import { Clock, ExternalLink, History, ThumbsUp } from 'lucide-react';
import { Tooltip, TooltipText } from '@/components/ui/Tooltip';
import { formatLastPlayed } from '@/lib/games/last-played';
import { steamStoreUrl } from '@/lib/games/store-link';
import { steamReviewLabel } from '@/lib/steam/review-label';
import { MIN_CRITIC_REVIEWS, ratingOf } from '@/lib/games/rating';
import { SteamDeckBadge } from './SteamDeckBadge';
import { playedHours } from '@/lib/games/playtime';
import { TruncatedText } from '@/components/ui/TruncatedText';

/**
 * Shows the rating games are ranked by (ratingOf), so a list sorted by Rating
 * reads in order. Steam's own score shows instead with `preferSteam`, or when
 * there's no ranked rating (a Steam score without its review count).
 */
export function GameRating({
  criticScore,
  criticCount,
  steamScore,
  steamCount,
  preferSteam = false,
  icon = true,
  iconClassName = 'w-3 h-3',
}: {
  criticScore?: number | null;
  criticCount?: number | null;
  steamScore?: number | null;
  steamCount?: number | null;
  /** Show Steam's own score, where it's what picked the game (Hidden Gems). */
  preferSteam?: boolean;
  /** Off under a column heading that already says what the figure is. */
  icon?: boolean;
  iconClassName?: string;
}) {
  const critic =
    criticScore != null && (criticCount ?? 0) >= MIN_CRITIC_REVIEWS ? criticScore : null;
  const steam = steamScore || null;
  const ranked = ratingOf({
    critic_score: criticScore,
    critic_count: criticCount,
    steam_review_score: steamScore,
    steam_review_count: steamCount,
  });
  const showSteam = steam !== null && (preferSteam || ranked === null);
  if (!showSteam && ranked === null) return null;

  const steamLabel =
    steam !== null && steamCount != null ? steamReviewLabel(steam, steamCount) : null;
  const steamDetail =
    steamCount != null
      ? `${steam}% of ${steamCount.toLocaleString('en-US')} Steam review${steamCount === 1 ? '' : 's'} are positive`
      : `${steam}% of Steam reviews are positive`;
  const criticText = critic !== null && (
    <TooltipText
      title={`Critic score: ${critic}`}
      detail={`The average of ${criticCount} critics' reviews`}
    />
  );
  const steamText = steam !== null && (
    <TooltipText title={steamLabel ?? steamDetail} detail={steamLabel ? steamDetail : undefined} />
  );
  return (
    <Tooltip
      content={
        // Steam's first where its score is the figure, else the critics'.
        (showSteam ? [steamText, criticText] : [criticText, steamText])
          .filter(Boolean)
          .map((text, i) => (
            <span key={i} className={i ? 'mt-1.5 block' : 'block'}>
              {text}
            </span>
          ))
      }
    >
      {icon && <ThumbsUp className={iconClassName} aria-hidden="true" />}
      {showSteam ? (
        <>
          <span>{steam}%</span>
          <span className="sr-only"> on Steam</span>
        </>
      ) : (
        <>
          <span>{Math.round(ranked!)}</span>
          <span className="sr-only"> rating</span>
        </>
      )}
    </Tooltip>
  );
}

/** HowLongToBeat's main story time, in hours. */
export function TimeToBeat({
  hours,
  icon = true,
  iconClassName = 'w-3 h-3',
}: {
  hours: number;
  /** Off under a column heading that already says what the figure is. */
  icon?: boolean;
  iconClassName?: string;
}) {
  return (
    <Tooltip content={<TooltipText title="Time to beat: Main Story" detail="From HowLongToBeat" />}>
      {icon && <Clock className={iconClassName} aria-hidden="true" />}
      <span>{hours}h</span>
      <span className="sr-only"> to beat the main story</span>
    </Tooltip>
  );
}

/**
 * `compact` is the meta-row form. It still shows "played" when the row is wide
 * enough, since a bare clock icon next to time-to-beat's clock is ambiguous.
 */
export function Playtime({
  minutes,
  lastPlayedAt,
  compact = false,
  showLabel = false,
  icon = true,
  iconClassName = 'w-3 h-3',
  className = '',
}: {
  minutes: number;
  lastPlayedAt?: string | null;
  compact?: boolean;
  /** With `compact`: always show "played", not only in a wide meta row. */
  showLabel?: boolean;
  /** With `compact`: off under a column heading that already says what it is. */
  icon?: boolean;
  iconClassName?: string;
  className?: string;
}) {
  const hours = playedHours(minutes);
  const lastPlayed = formatLastPlayed(lastPlayedAt);
  return (
    <Tooltip
      className={className}
      content={
        // Only Steam reports when you last played. Without a date the hours may
        // be ones you entered for a console game, so the tooltip doesn't say Steam.
        lastPlayed ? (
          <TooltipText title={lastPlayed} detail={`${hours}h played on Steam`} />
        ) : (
          <TooltipText title={`${hours}h played`} />
        )
      }
    >
      {compact ? (
        <>
          {icon && <History className={iconClassName} aria-hidden="true" />}
          <span>{hours}h</span>
          {/* Read out always; shown when there's room (the meta row is a container). */}
          <span className={showLabel ? '' : 'sr-only @[16rem]:not-sr-only'}> played</span>
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
  criticScore?: number | null;
  criticCount?: number | null;
  preferSteamRating?: boolean;
  playtimeMinutes?: number;
  lastPlayedAt?: string | null;
  deckCompat?: number | null;
  hidePlaytimeOnMobile?: boolean;
  /** consoleOf: with one, the Deck rating and Steam's last-played date aren't shown. */
  console?: string | null;
  /** The platform tag drawn on the art beside this row (platformTag), named for screen readers. */
  artTag?: string | null;
}

export function GameMetaRow({
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  criticScore,
  criticCount,
  preferSteamRating,
  playtimeMinutes = 0,
  lastPlayedAt,
  deckCompat,
  hidePlaytimeOnMobile,
  console,
  artTag,
}: GameMetaRowProps) {
  if (console) deckCompat = null;
  const rating = (
    <GameRating
      criticScore={criticScore}
      criticCount={criticCount}
      steamScore={steamReviewScore}
      steamCount={steamReviewCount}
      preferSteam={preferSteamRating}
    />
  );
  const hasRating = (criticCount ?? 0) >= MIN_CRITIC_REVIEWS || !!steamReviewScore;
  if (!artTag && !mainStoryHours && !hasRating && playtimeMinutes < 60 && !deckCompat) return null;
  return (
    <div className="@container flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-500 whitespace-nowrap">
      {artTag && <span className="sr-only">On {artTag}</span>}
      {mainStoryHours ? <TimeToBeat hours={mainStoryHours} /> : null}
      {rating}
      {playtimeMinutes >= 60 ? (
        <Playtime
          compact
          minutes={playtimeMinutes}
          // Only Steam's date is shown (see steamLastPlayed).
          lastPlayedAt={console ? null : lastPlayedAt}
          className={hidePlaytimeOnMobile ? 'max-sm:hidden' : ''}
        />
      ) : null}
      <SteamDeckBadge deckCompat={deckCompat} />
    </div>
  );
}

interface GameCardInfoProps {
  /** Steam's app id; the title links to the store page when there is one. */
  appId?: number | null;
  name: string;
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  criticScore?: number | null;
  criticCount?: number | null;
  preferSteamRating?: boolean;
  playtimeMinutes?: number;
  lastPlayedAt?: string | null;
  deckCompat?: number | null;
  /** consoleOf: a console game gets no store link. */
  console?: string | null;
  /** The platform tag drawn on the game's art (platformTag), named for screen readers. */
  artTag?: string | null;
}

export function GameCardInfo({
  appId,
  name,
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  criticScore,
  criticCount,
  preferSteamRating,
  playtimeMinutes = 0,
  lastPlayedAt,
  deckCompat,
  console,
  artTag,
}: GameCardInfoProps) {
  const storeUrl = steamStoreUrl({ app_id: appId, platform: console });
  return (
    <>
      {storeUrl ? (
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group/title flex items-center gap-1 text-ink-100 font-medium hover:text-ink-50 transition-colors cursor-pointer"
        >
          <TruncatedText className="truncate min-w-0">{name}</TruncatedText>
          <ExternalLink
            className="w-3 h-3 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity mb-px"
            aria-hidden="true"
          />
        </a>
      ) : (
        <TruncatedText as="p" className="truncate text-ink-100 font-medium">
          {name}
        </TruncatedText>
      )}
      <div className="mt-1">
        <GameMetaRow
          mainStoryHours={mainStoryHours}
          steamReviewScore={steamReviewScore}
          steamReviewCount={steamReviewCount}
          criticScore={criticScore}
          criticCount={criticCount}
          preferSteamRating={preferSteamRating}
          playtimeMinutes={playtimeMinutes}
          lastPlayedAt={lastPlayedAt}
          deckCompat={deckCompat}
          console={console}
          artTag={artTag}
        />
      </div>
    </>
  );
}
