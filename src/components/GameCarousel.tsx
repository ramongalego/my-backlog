'use client';

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CoverArt, CoverEditHint } from '@/components/games/CoverArt';
import { GameCardInfo } from '@/components/games/GameCardInfo';
import { createSwipeTracker, isOnScreen, loopCopies, wrap } from '@/lib/carousel-loop';
import { consoleOf } from '@/lib/games/manual';
import {
  CAROUSEL_CARD_WIDTH as CARD_WIDTH,
  CAROUSEL_FADE_CLASS,
  CAROUSEL_FADE_STYLE,
  CAROUSEL_PER_PAGE as PER_PAGE,
} from '@/components/games/carousel-layout';

interface Game {
  id: number;
  app_id: number | null;
  source?: string;
  platform?: string | null;
  name: string;
  header_image: string | null;
  main_story_hours: number | null;
  playtime_forever: number;
  steam_review_score?: number | null;
  steam_review_count?: number | null;
  critic_score?: number | null;
  critic_count?: number | null;
  deck_compat?: number | null;
  last_played_at?: string | null;
  release_date?: string | null;
}

interface GameCarouselProps {
  title: string;
  games: Game[];
  onOpenDetail?: (game: Game) => void;
  /** Show Steam's review score first on these cards (a row picked by it). */
  preferSteamRating?: boolean;
  /** Fewer games than this and the row is left out (MIN_CAROUSEL_GAMES by default). */
  minGames?: number;
  /** Mark this carousel as above the fold so the first images get priority loading. */
  priority?: boolean;
}

/** A row of picks needs a few games to choose between; fewer reads as a gap. */
export const MIN_CAROUSEL_GAMES = 3;

// The endless, arrow-driven loop is for a mouse on a wide screen. Touch
// screens and phones swipe a native scroller instead, as Netflix does.
const LOOP_MEDIA = '(min-width: 640px) and (pointer: fine)';
// Short, as product motion should be, but long enough to read as a slide.
const SLIDE_MS = 450;
const SLIDE_EASING = 'cubic-bezier(0.25, 1, 0.5, 1)';

// The same width from the row's container width, to size the arrows to the art.
const CARD_WIDTH_CQ = '((100cqw - (var(--per-page) - 1) * 1rem) / var(--per-page))';
const COVER_HEIGHT = `calc(${CARD_WIDTH_CQ} * 215 / 460)`;
// What's left of the row after a page of whole cards: the peeking card.
const peekWidth = (pageSize: number) => `calc(100cqw - ${pageSize} * (${CARD_WIDTH_CQ} + 1rem))`;
const COVER_SIZES =
  '(max-width: 640px) 70vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 250px';

function subscribeToLoopMedia(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(LOOP_MEDIA);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** Whether to loop. False on the server, so the first render is the scroller everywhere. */
function useLoopMode() {
  return useSyncExternalStore(
    subscribeToLoopMedia,
    () => typeof window.matchMedia === 'function' && window.matchMedia(LOOP_MEDIA).matches,
    () => false,
  );
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** The row's --per-page, kept current as the window resizes. */
function usePerPage(rowRef: React.RefObject<HTMLDivElement | null>) {
  const [perPage, setPerPage] = useState(4);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const read = () => {
      const value = parseFloat(getComputedStyle(row).getPropertyValue('--per-page'));
      if (value > 0) setPerPage(value);
    };
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const observer = new ResizeObserver(read);
    observer.observe(row);
    return () => observer.disconnect();
  }, [rowRef]);
  return perPage;
}

export function GameCarousel({
  title,
  games,
  onOpenDetail,
  priority = false,
  preferSteamRating,
  minGames = MIN_CAROUSEL_GAMES,
}: GameCarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const perPage = usePerPage(rowRef);
  const loopMode = useLoopMode();

  // The first visible game. While sliding it can step past either end of the
  // list; once the slide finishes it's wrapped back into 0..count-1.
  const [offset, setOffset] = useState(0);
  const [sliding, setSliding] = useState(false);
  // Like Netflix, the left arrow only appears once you've moved.
  const [hasMoved, setHasMoved] = useState(false);

  const count = games.length;
  const pageSize = Math.max(1, Math.floor(perPage));
  // Whole cards plus the peeking one.
  const visibleSpan = Math.ceil(perPage);
  const hasMore = count > pageSize;
  const loop = loopMode && hasMore;
  const { before, after } = loop
    ? loopCopies(count, pageSize, visibleSpan)
    : { before: 0, after: 0 };
  const first = loop ? (sliding ? offset : wrap(offset, count)) : 0;
  const start = before * count + first;

  const finishSlide = () => {
    setSliding(false);
    setOffset((o) => wrap(o, count));
  };

  // transitionend doesn't fire if the slide is interrupted or the tab is
  // hidden, so a timer finishes the slide regardless.
  useEffect(() => {
    if (!sliding) return;
    const id = setTimeout(finishSlide, SLIDE_MS + 150);
    return () => clearTimeout(id);
  });

  const slide = (direction: 1 | -1) => {
    if (!loop || sliding) return;
    setHasMoved(true);
    const next = wrap(offset, count) + direction * pageSize;
    if (prefersReducedMotion()) {
      setOffset(wrap(next, count));
      return;
    }
    setOffset(next);
    setSliding(true);
  };

  // A horizontal trackpad swipe pages the row like the arrows: one page per
  // swipe, whatever its length or momentum (see createSwipeTracker).
  const onSwipe = useEffectEvent((direction: 1 | -1) => slide(direction));
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !loop) return;
    const track = createSwipeTracker();
    const onWheel = (e: WheelEvent) => {
      // Vertical scrolling, and a mostly vertical one that drifts, still scrolls the page.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      // Claim the whole horizontal stream, coasting included, so the browser
      // doesn't take the swipe as back/forward navigation.
      e.preventDefault();
      const pixels =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? e.deltaX * 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? e.deltaX * row.clientWidth
            : e.deltaX;
      const direction = track(pixels, e.timeStamp);
      if (direction) onSwipe(direction);
    };
    // Not passive: preventDefault has to work.
    row.addEventListener('wheel', onWheel, { passive: false });
    return () => row.removeEventListener('wheel', onWheel);
  }, [loop]);

  if (count < minGames) return null;

  const positions = loop
    ? Array.from({ length: (before + 1 + after) * count }, (_, i) => i)
    : games.map((_, i) => i);

  return (
    <div>
      <h2 className="mb-4 text-lg sm:text-xl font-semibold tracking-tight text-ink-50">{title}</h2>

      <div
        ref={rowRef}
        role="region"
        aria-label={title}
        className={`group/row relative @container ${PER_PAGE}`}
      >
        {loop && hasMoved && <ArrowButton direction="previous" onClick={() => slide(-1)} />}

        {/* Always there when the row has more: the arrows only appear on hover. */}
        {hasMore && (
          <div aria-hidden="true" className={CAROUSEL_FADE_CLASS} style={CAROUSEL_FADE_STYLE} />
        )}

        {/* The clipping box. The browser scrolls it to show a focused element, which
            would shift the whole row on top of the transform, so it's pinned at 0. */}
        <div
          className={loop ? 'overflow-hidden' : undefined}
          onScroll={loop ? (e) => (e.currentTarget.scrollLeft = 0) : undefined}
        >
          <div
            onTransitionEnd={(e) => {
              if (e.target === e.currentTarget) finishSlide();
            }}
            className={
              loop
                ? 'flex gap-4'
                : 'flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 scroll-px-4 sm:mx-0 sm:px-0 sm:scroll-px-0'
            }
            style={
              loop
                ? {
                    transform: `translateX(calc(-1 * ${start} * (${CARD_WIDTH} + 1rem)))`,
                    transition: sliding ? `transform ${SLIDE_MS}ms ${SLIDE_EASING}` : 'none',
                  }
                : { scrollbarWidth: 'none' }
            }
          >
            {positions.map((position) => {
              const game = games[position % count];
              // Off-screen cards (including every copy) can't be tabbed to or
              // read out: focusing one would scroll the row out of place. Nothing
              // is reachable mid-slide, when the incoming page is still off screen.
              const hidden = loop && (sliding || !isOnScreen(position, start, pageSize));
              const indexInList = position - before * count;
              return (
                <div
                  key={`${Math.floor(position / count)}-${game.id}`}
                  className={`relative min-w-0 ${loop ? '' : 'snap-start'}`}
                  style={{ flex: `0 0 ${CARD_WIDTH}` }}
                  aria-hidden={hidden || undefined}
                  inert={hidden || undefined}
                >
                  <button
                    onClick={() => onOpenDetail?.(game)}
                    className="group block w-full rounded-lg cursor-pointer select-none focus-visible:-outline-offset-2"
                    aria-label={`Open details for ${game.name}`}
                  >
                    <CoverArt
                      src={game.header_image}
                      alt=""
                      sizes={COVER_SIZES}
                      priority={priority && indexInList >= 0 && indexInList < 4 ? true : undefined}
                      interactive
                      platform={consoleOf(game)}
                      releaseDate={game.release_date}
                    >
                      <CoverEditHint />
                    </CoverArt>
                  </button>
                  <div className="pt-3">
                    <GameCardInfo
                      appId={game.app_id}
                      name={game.name}
                      mainStoryHours={game.main_story_hours}
                      steamReviewScore={game.steam_review_score}
                      steamReviewCount={game.steam_review_count}
                      criticScore={game.critic_score}
                      criticCount={game.critic_count}
                      preferSteamRating={preferSteamRating}
                      playtimeMinutes={game.playtime_forever}
                      lastPlayedAt={game.last_played_at}
                      deckCompat={game.deck_compat}
                      platform={consoleOf(game)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {loop && (
          <ArrowButton direction="next" onClick={() => slide(1)} width={peekWidth(pageSize)} />
        )}
      </div>
    </div>
  );
}

/** A full-height arrow over the edge of the art, shown while hovering the row. */
function ArrowButton({
  direction,
  onClick,
  width,
}: {
  direction: 'previous' | 'next';
  onClick: () => void;
  /** The next arrow covers the whole peeking card, so clicking it pages on. */
  width?: string;
}) {
  const isNext = direction === 'next';
  const Icon = isNext ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isNext ? 'Show more games' : 'Show previous games'}
      className={`group/arrow absolute top-0 z-10 flex min-w-12 items-center justify-center cursor-pointer opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:-outline-offset-2 ${
        isNext ? 'right-0 rounded-r-lg' : 'left-0 rounded-l-lg'
      }`}
      style={{
        height: COVER_HEIGHT,
        width: width ?? '3rem',
        background: `linear-gradient(to ${isNext ? 'left' : 'right'}, color-mix(in oklch, var(--color-ink-950) 85%, transparent), transparent)`,
      }}
    >
      <Icon
        className="w-7 h-7 text-ink-50 transition-transform group-hover/arrow:scale-125 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
  );
}
