'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { GameCardInfo } from '@/components/games/GameCardInfo';

interface Game {
  app_id: number;
  name: string;
  header_image: string | null;
  main_story_hours: number | null;
  playtime_forever: number;
  steam_review_score?: number | null;
  steam_review_count?: number | null;
  deck_compat?: number | null;
}

interface GameCarouselProps {
  title: string;
  games: Game[];
  onOpenDetail?: (game: Game) => void;
  /** Mark this carousel as above the fold so the first images get priority loading. */
  priority?: boolean;
}

export function GameCarousel({ title, games, onOpenDetail, priority = false }: GameCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function syncButtons() {
      if (el) {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
      }
    }

    syncButtons();

    function handleScroll() {
      // Skip mid-animation updates — the optimistic state is already correct
      if (!isAnimatingRef.current) syncButtons();
    }

    function handleScrollEnd() {
      isAnimatingRef.current = false;
      syncButtons();
    }

    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('scrollend', handleScrollEnd, { passive: true });
    window.addEventListener('resize', syncButtons);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('scrollend', handleScrollEnd);
      window.removeEventListener('resize', syncButtons);
    };
  }, [games]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const scrollAmount = 272;
      const delta = direction === 'left' ? -scrollAmount : scrollAmount;
      const target = Math.max(0, Math.min(scrollLeft + delta, scrollWidth - clientWidth));

      // Set optimistic state and suppress scroll-event overrides until scrollend
      isAnimatingRef.current = true;
      setCanScrollLeft(target > 0);
      setCanScrollRight(target + clientWidth < scrollWidth - 1);

      scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  if (games.length < 3) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-ink-50">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="p-2 rounded-full bg-ink-800 hover:bg-ink-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-ink-800"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-ink-300" aria-hidden="true" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-2 rounded-full bg-ink-800 hover:bg-ink-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-ink-800"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-ink-300" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden" role="region" aria-label={title}>
        <div
          className="absolute right-0 top-0 bottom-4 w-24 z-10 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'linear-gradient(to right, transparent, var(--color-ink-950))',
          }}
        />

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none' }}
        >
          {games.map((game, i) => (
            <div key={game.app_id} className="group shrink-0 w-64 relative">
              <button
                onClick={() => onOpenDetail?.(game)}
                className="relative block w-full aspect-[460/215] overflow-hidden rounded-lg bg-ink-900 cursor-pointer select-none focus-visible:-outline-offset-2 after:absolute after:inset-0 after:rounded-lg after:ring-1 after:ring-inset after:ring-white/8 after:transition-colors hover:after:ring-white/20"
                aria-label={`Open details for ${game.name}`}
              >
                {game.header_image ? (
                  <Image
                    src={game.header_image}
                    alt={game.name}
                    fill
                    priority={priority && i < 4 ? true : undefined}
                    className="object-cover"
                    sizes="256px"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <Pencil
                    className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                    aria-hidden="true"
                  />
                </div>
              </button>
              <div className="pt-3">
                <GameCardInfo
                  appId={game.app_id}
                  name={game.name}
                  mainStoryHours={game.main_story_hours}
                  steamReviewScore={game.steam_review_score}
                  steamReviewCount={game.steam_review_count}
                  playtimeMinutes={game.playtime_forever}
                  deckCompat={game.deck_compat}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
