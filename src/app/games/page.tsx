'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Clock, Gamepad2, Star, Undo2, Check, X, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/Header';

interface Game {
  app_id: number;
  name: string;
  playtime_forever: number;
  steam_review_score: number | null;
  steam_review_count: number | null;
  steam_review_weighted: number | null;
  header_image: string | null;
  main_story_hours: number | null;
  status: string | null;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    'all' | 'backlog' | 'finished' | 'dropped' | 'hidden'
  >('all');

  useEffect(() => {
    async function loadGames() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('games')
        .select(
          'app_id, name, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, header_image, main_story_hours, status',
        )
        .eq('user_id', user.id)
        .eq('type', 'game')
        .order('playtime_forever', { ascending: false });

      setGames(data || []);
      setLoading(false);
    }

    loadGames();
  }, []);

  const handleStatusChange = async (appId: number, status: string) => {
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, status }),
      });
      setGames(prev =>
        prev.map(g => (g.app_id === appId ? { ...g, status } : g)),
      );
    } catch (err) {
      console.error('Failed to update game status:', err);
    }
  };

  const filteredGames = games.filter(game => {
    if (filter === 'all') return game.status !== 'hidden';
    if (filter === 'backlog') return !game.status || game.status === 'backlog';
    return game.status === filter;
  });

  const counts = {
    all: games.length,
    backlog: games.filter(g => !g.status || g.status === 'backlog').length,
    finished: games.filter(g => g.status === 'finished').length,
    dropped: games.filter(g => g.status === 'dropped').length,
    hidden: games.filter(g => g.status === 'hidden').length,
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-zinc-950'>
        <Header />
        <div className='pt-24 px-6'>
          <div className='max-w-6xl mx-auto'>
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'>
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className='bg-zinc-900 rounded-lg overflow-hidden animate-pulse'
                >
                  <div className='h-40 sm:h-28 bg-zinc-800' />
                  <div className='p-3 space-y-2'>
                    <div className='h-4 bg-zinc-800 rounded w-3/4' />
                    <div className='h-3 bg-zinc-800 rounded w-1/2' />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-950'>
      <Header />

      <main className='pt-24 pb-12 px-6'>
        <div className='max-w-6xl mx-auto'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8'>
            <div>
              <h1 className='text-2xl font-bold text-zinc-100'>My Games</h1>
              <p className='text-zinc-500 text-sm mt-1'>
                {games.length} games in library
              </p>
            </div>

            <div className='flex gap-2 overflow-x-auto pb-2 -mb-2'>
              {(
                ['all', 'backlog', 'finished', 'dropped', 'hidden'] as const
              ).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filter === f
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className='ml-1.5 text-xs opacity-60'>{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div className='text-center py-16'>
              <Gamepad2 className='w-12 h-12 text-zinc-700 mx-auto mb-4' />
              <p className='text-zinc-500'>No games found</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'>
              {filteredGames.map(game => (
                <div
                  key={game.app_id}
                  className='group bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all sm:hover:scale-[1.02]'
                >
                  <div className='relative h-40 sm:h-28'>
                    {game.header_image ? (
                      <Image
                        src={game.header_image}
                        alt={game.name}
                        fill
                        className='object-cover'
                        sizes='(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                      />
                    ) : (
                      <div className='w-full h-full bg-zinc-800 flex items-center justify-center'>
                        <Gamepad2 className='w-8 h-8 text-zinc-700' />
                      </div>
                    )}
                    {game.status === 'finished' && (
                      <div className='absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/90 text-white text-xs font-medium rounded'>
                        Finished
                      </div>
                    )}
                    {game.status === 'dropped' && (
                      <div className='absolute top-2 right-2 px-2 py-0.5 bg-zinc-600/90 text-white text-xs font-medium rounded'>
                        Dropped
                      </div>
                    )}
                    {game.status === 'hidden' && (
                      <div className='absolute top-2 right-2 px-2 py-0.5 bg-zinc-700/90 text-white text-xs font-medium rounded'>
                        Hidden
                      </div>
                    )}
                    {(game.status === 'finished' ||
                      game.status === 'dropped' ||
                      game.status === 'hidden') && (
                      <button
                        onClick={() =>
                          handleStatusChange(game.app_id, 'backlog')
                        }
                        className='cursor-pointer absolute inset-0 bg-black/60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'
                      >
                        <Undo2 className='w-4 h-4 text-white' />
                        <span className='text-white font-medium text-sm'>
                          {game.status === 'hidden'
                            ? 'Unhide'
                            : 'Move to Backlog'}
                        </span>
                      </button>
                    )}
                    {(!game.status || game.status === 'backlog') && (
                      <div className='absolute inset-0 bg-black/60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 sm:gap-2'>
                        <button
                          onClick={() =>
                            handleStatusChange(game.app_id, 'finished')
                          }
                          className='cursor-pointer flex items-center gap-1.5 sm:gap-1 px-4 sm:px-2 py-2.5 sm:py-1.5 bg-emerald-600/80 hover:bg-emerald-600 rounded-lg sm:rounded transition-colors'
                          title='Mark as finished'
                        >
                          <Check className='w-5 sm:w-3.5 h-5 sm:h-3.5 text-white' />
                          <span className='text-white text-sm sm:text-xs font-medium'>
                            Finish
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(game.app_id, 'dropped')
                          }
                          className='cursor-pointer flex items-center gap-1.5 sm:gap-1 px-4 sm:px-2 py-2.5 sm:py-1.5 bg-zinc-600/80 hover:bg-zinc-600 rounded-lg sm:rounded transition-colors'
                          title='Mark as dropped'
                        >
                          <X className='w-5 sm:w-3.5 h-5 sm:h-3.5 text-white' />
                          <span className='text-white text-sm sm:text-xs font-medium'>
                            Drop
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(game.app_id, 'hidden')
                          }
                          className='cursor-pointer flex items-center gap-1.5 sm:gap-1 px-4 sm:px-2 py-2.5 sm:py-1.5 bg-zinc-700/80 hover:bg-zinc-700 rounded-lg sm:rounded transition-colors'
                          title='Hide game'
                        >
                          <EyeOff className='w-5 sm:w-3.5 h-5 sm:h-3.5 text-zinc-300' />
                          <span className='text-zinc-300 text-sm sm:text-xs font-medium'>
                            Hide
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className='p-3'>
                    <h3
                      className='text-zinc-100 font-medium text-sm truncate'
                      title={game.name}
                    >
                      {game.name}
                    </h3>
                    <div className='flex items-center gap-3 mt-2 text-xs text-zinc-500'>
                      {game.main_story_hours && (
                        <span
                          className='flex items-center gap-1'
                          title='Time to beat'
                        >
                          <Clock className='w-3 h-3' />
                          {game.main_story_hours}h
                        </span>
                      )}
                      {game.steam_review_score && (
                        <span
                          className='flex items-center gap-1'
                          title={`Steam reviews${game.steam_review_count ? ` (${game.steam_review_count.toLocaleString()} reviews)` : ''}`}
                        >
                          <Star className='w-3 h-3' />
                          {game.steam_review_score}%
                        </span>
                      )}
                      {game.playtime_forever > 0 && (
                        <span className='text-zinc-600' title='Played'>
                          {Math.round(game.playtime_forever / 60)}h played
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
