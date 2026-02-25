'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
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
}

interface GameCarouselProps {
  title: string;
  games: Game[];
  onOpenDetail?: (game: Game) => void;
}

export function GameCarousel({ title, games, onOpenDetail }: GameCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons, games]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 272;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (games.length === 0) return null;

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
            <ChevronLeft className="w-5 h-5 text-zinc-300" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-800"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-zinc-300" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div
          className="absolute right-0 top-0 bottom-4 w-24 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, transparent, rgb(9, 9, 11))',
          }}
        />

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none' }}
        >
          {games.map((game) => (
            <div
              key={game.app_id}
              className="group shrink-0 w-64 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors relative"
            >
              <button
                onClick={() => onOpenDetail?.(game)}
                className="relative h-32 w-full block cursor-pointer"
                aria-label={`Open details for ${game.name}`}
              >
                {game.header_image ? (
                  <Image
                    src={game.header_image}
                    alt={game.name}
                    fill
                    className="object-cover"
                    sizes="256px"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                  <Pencil className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
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
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
