'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { GameCardInfo } from '@/components/games/GameCardInfo';

interface Game {
  app_id: number;
  name: string;
  header_image: string | null;
  main_story_hours: number;
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg sm:text-2xl font-bold text-zinc-100">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-800"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-300" aria-hidden="true" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-800"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-zinc-300" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden" role="region" aria-label={title}>
        <div
          className="absolute right-0 top-0 bottom-4 w-24 z-10 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'linear-gradient(to right, transparent, rgb(9, 9, 11))',
          }}
        />

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none' }}
        >
          {games.map((game, i) => (
            <div
              key={game.app_id}
              className="group shrink-0 w-64 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors relative"
            >
              <button
                onClick={() => onOpenDetail?.(game)}
                className="relative h-32 w-full block cursor-pointer focus:outline-none select-none"
                aria-label={`Open details for ${game.name}`}
              >
                {game.header_image ? (
                  <Image
                    src={game.header_image}
                    alt={game.name}
                    fill
                    priority={priority && i < 4}
                    className="object-cover"
                    sizes="256px"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                  <Pencil
                    className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                    aria-hidden="true"
                  />
                </div>
              </button>
              <div className="px-3 py-4">
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
