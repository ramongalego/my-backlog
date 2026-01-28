'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Clock, Gamepad2, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/Header';

interface Game {
  app_id: number;
  name: string;
  playtime_forever: number;
  metacritic: number | null;
  header_image: string | null;
  main_story_hours: number | null;
  status: string | null;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'backlog' | 'finished' | 'dropped'>('all');

  useEffect(() => {
    async function loadGames() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('games')
        .select('app_id, name, playtime_forever, metacritic, header_image, main_story_hours, status')
        .eq('user_id', user.id)
        .eq('type', 'game')
        .order('playtime_forever', { ascending: false });

      setGames(data || []);
      setLoading(false);
    }

    loadGames();
  }, []);

  const filteredGames = games.filter(game => {
    if (filter === 'all') return true;
    if (filter === 'backlog') return !game.status || game.status === 'backlog';
    return game.status === filter;
  });

  const counts = {
    all: games.length,
    backlog: games.filter(g => !g.status || g.status === 'backlog').length,
    finished: games.filter(g => g.status === 'finished').length,
    dropped: games.filter(g => g.status === 'dropped').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="pt-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden animate-pulse">
                  <div className="h-28 bg-zinc-800" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800 rounded w-1/2" />
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
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">My Games</h1>
              <p className="text-zinc-500 text-sm mt-1">{games.length} games in library</p>
            </div>

            <div className="flex gap-2">
              {(['all', 'backlog', 'finished', 'dropped'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filter === f
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1.5 text-xs opacity-60">{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div className="text-center py-16">
              <Gamepad2 className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">No games found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredGames.map((game) => (
                <div
                  key={game.app_id}
                  className="group bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all hover:scale-[1.02]"
                >
                  <div className="relative h-28">
                    {game.header_image ? (
                      <Image
                        src={game.header_image}
                        alt={game.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <Gamepad2 className="w-8 h-8 text-zinc-700" />
                      </div>
                    )}
                    {game.status === 'finished' && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/90 text-white text-xs font-medium rounded">
                        Finished
                      </div>
                    )}
                    {game.status === 'dropped' && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-zinc-600/90 text-white text-xs font-medium rounded">
                        Dropped
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-zinc-100 font-medium text-sm truncate" title={game.name}>
                      {game.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                      {game.main_story_hours && (
                        <span className="flex items-center gap-1" title="Time to beat">
                          <Clock className="w-3 h-3" />
                          {game.main_story_hours}h
                        </span>
                      )}
                      {game.metacritic && (
                        <span className="flex items-center gap-1" title="Metacritic">
                          <Star className="w-3 h-3" />
                          {game.metacritic}
                        </span>
                      )}
                      {game.playtime_forever > 0 && (
                        <span className="text-zinc-600" title="Played">
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
