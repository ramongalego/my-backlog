'use client';

import { useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface Game {
  app_id: number;
  name: string;
  header_image: string | null;
  main_story_hours: number;
}

interface GameCarouselProps {
  title: string;
  games: Game[];
  onPickGame?: (game: Game) => void;
}

export function GameCarousel({ title, games, onPickGame }: GameCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Triple the games for infinite effect
  const tripleGames = [...games, ...games, ...games];

  // Initialize scroll position to start of middle set (first game fully visible)
  useEffect(() => {
    if (scrollRef.current && games.length > 0) {
      // Calculate the exact position where middle set starts
      // Each card is 256px (w-64) + 16px gap = 272px per card
      const cardWidth = 272;
      const middleSetStart = games.length * cardWidth;
      scrollRef.current.scrollLeft = middleSetStart;
    }
  }, [games.length]);

  // Handle infinite scroll repositioning
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isScrollingRef.current) return;

    const { scrollLeft } = scrollRef.current;
    const cardWidth = 272;
    const singleSetWidth = games.length * cardWidth;

    // If scrolled into first set, jump to middle set
    if (scrollLeft < singleSetWidth * 0.5) {
      isScrollingRef.current = true;
      scrollRef.current.scrollLeft = scrollLeft + singleSetWidth;
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    }
    // If scrolled into last set, jump to middle set
    else if (scrollLeft > singleSetWidth * 2.5) {
      isScrollingRef.current = true;
      scrollRef.current.scrollLeft = scrollLeft - singleSetWidth;
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    }
  }, [games.length]);

  // Debounced scroll handler
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let timeoutId: NodeJS.Timeout;
    const debouncedScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };

    el.addEventListener('scroll', debouncedScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', debouncedScroll);
      clearTimeout(timeoutId);
    };
  }, [handleScroll]);

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
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-2xl font-bold text-zinc-100'>{title}</h2>
        <div className='flex gap-2'>
          <button
            onClick={() => scroll('left')}
            className='p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer'
            aria-label='Scroll left'
          >
            <ChevronLeft className='w-5 h-5 text-zinc-300' />
          </button>
          <button
            onClick={() => scroll('right')}
            className='p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer'
            aria-label='Scroll right'
          >
            <ChevronRight className='w-5 h-5 text-zinc-300' />
          </button>
        </div>
      </div>

      <div className='relative overflow-hidden'>
        {/* Fade overlay - right edge */}
        <div
          className='absolute right-0 top-0 bottom-4 w-24 z-10 pointer-events-none'
          style={{
            background: 'linear-gradient(to right, transparent, rgb(9, 9, 11))',
          }}
        />

        <div
          ref={scrollRef}
          className='flex gap-4 overflow-x-auto pb-4'
          style={{ scrollbarWidth: 'none' }}
        >
          {tripleGames.map((game, index) => (
            <div
              key={`${game.app_id}-${index}`}
              className='group shrink-0 w-64 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors relative'
            >
              <div className='relative h-32'>
                {game.header_image ? (
                  <Image
                    src={game.header_image}
                    alt={game.name}
                    fill
                    className='object-cover'
                    sizes='256px'
                  />
                ) : (
                  <div className='w-full h-full bg-zinc-800' />
                )}
                {onPickGame && (
                  <button
                    onClick={() => onPickGame(game)}
                    className='cursor-pointer absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'
                  >
                    <Play className='w-5 h-5 text-white fill-white' />
                    <span className='text-white font-medium'>Pick Game</span>
                  </button>
                )}
              </div>
              <div className='p-4'>
                <h3 className='text-zinc-100 font-medium truncate'>
                  {game.name}
                </h3>
                <p className='text-zinc-500 text-sm mt-1'>
                  {game.main_story_hours}h to complete
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
