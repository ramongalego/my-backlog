'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import { GameCarousel } from '@/components/GameCarousel';
import { CurrentlyPlaying } from '@/components/CurrentlyPlaying';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Profile {
  steam_id: string | null;
  steam_username: string | null;
  steam_avatar: string | null;
}

interface Game {
  app_id: number;
  name: string;
}

interface ShortGame {
  app_id: number;
  name: string;
  header_image: string | null;
  main_story_hours: number;
}

function HomeContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gameCount, setGameCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [shortGames, setShortGames] = useState<ShortGame[]>([]);
  const [weekendGames, setWeekendGames] = useState<ShortGame[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<ShortGame | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const syncingRef = useRef(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const syncGames = useCallback(async (games: Game[]) => {
    for (let i = 0; i < games.length; i++) {
      setSyncProgress({ current: i + 1, total: games.length });

      try {
        await fetch('/api/games/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: games[i].app_id }),
        });
      } catch (err) {
        console.error(`Failed to sync ${games[i].name}:`, err);
      }
    }
  }, []);

  const handlePickGame = async (game: ShortGame) => {
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: game.app_id, status: 'playing' }),
      });
      setCurrentlyPlaying(game);
      setShortGames(prev => prev.filter(g => g.app_id !== game.app_id));
      setWeekendGames(prev => prev.filter(g => g.app_id !== game.app_id));
    } catch (err) {
      console.error('Failed to pick game:', err);
    }
    setIsStatusLoading(false);
  };

  const handleFinishGame = async () => {
    if (!currentlyPlaying) return;
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: currentlyPlaying.app_id, status: 'finished' }),
      });
      setCurrentlyPlaying(null);
    } catch (err) {
      console.error('Failed to finish game:', err);
    }
    setIsStatusLoading(false);
  };

  const handleDropGame = async () => {
    if (!currentlyPlaying) return;
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: currentlyPlaying.app_id, status: 'dropped' }),
      });
      setCurrentlyPlaying(null);
    } catch (err) {
      console.error('Failed to drop game:', err);
    }
    setIsStatusLoading(false);
  };

  const handleCancelGame = async () => {
    if (!currentlyPlaying) return;
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: currentlyPlaying.app_id, status: 'backlog' }),
      });
      if (currentlyPlaying.main_story_hours <= 5) {
        setShortGames(prev => [...prev, currentlyPlaying]);
      } else if (currentlyPlaying.main_story_hours <= 12) {
        setWeekendGames(prev => [...prev, currentlyPlaying]);
      }
      setCurrentlyPlaying(null);
    } catch (err) {
      console.error('Failed to cancel game:', err);
    }
    setIsStatusLoading(false);
  };

  useEffect(() => {
    if (searchParams.has('error')) {
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const supabase = createClient();

    async function loadUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('steam_id, steam_username, steam_avatar')
          .eq('id', user.id)
          .single();

        setProfile(profileData);

        if (profileData?.steam_id) {
          const { count: totalGames } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          setGameCount(totalGames || 0);
          setIsLoading(false);

          const { data: unsyncedGames } = await supabase
            .from('games')
            .select('app_id, name')
            .eq('user_id', user.id)
            .or('metadata_synced.is.null,metadata_synced.eq.false');

          if (
            unsyncedGames &&
            unsyncedGames.length > 0 &&
            !syncingRef.current
          ) {
            syncingRef.current = true;
            setIsSyncing(true);
            setSyncProgress({ current: 0, total: unsyncedGames.length });
            await syncGames(unsyncedGames);
            setIsSyncing(false);
            syncingRef.current = false;
          }

          const { data: playingGame } = await supabase
            .from('games')
            .select('app_id, name, header_image, main_story_hours')
            .eq('user_id', user.id)
            .eq('status', 'playing')
            .single();

          if (playingGame) {
            setCurrentlyPlaying(playingGame);
          }

          const { data: shortGamesData } = await supabase
            .from('games')
            .select('app_id, name, header_image, main_story_hours')
            .eq('user_id', user.id)
            .not('main_story_hours', 'is', null)
            .not('metacritic', 'is', null)
            .gte('main_story_hours', 1)
            .lte('main_story_hours', 5)
            .lte('playtime_forever', 240)
            .contains('categories', ['Single-player'])
            .or('status.is.null,status.eq.backlog')
            .order('metacritic', { ascending: false })
            .limit(10);

          setShortGames(shortGamesData || []);

          const { data: weekendGamesData } = await supabase
            .from('games')
            .select('app_id, name, header_image, main_story_hours')
            .eq('user_id', user.id)
            .not('main_story_hours', 'is', null)
            .not('metacritic', 'is', null)
            .gt('main_story_hours', 5)
            .lte('main_story_hours', 12)
            .lte('playtime_forever', 240)
            .contains('categories', ['Single-player'])
            .or('status.is.null,status.eq.backlog')
            .order('metacritic', { ascending: false })
            .limit(10);

          setWeekendGames(weekendGamesData || []);
          return;
        }
      }

      setIsLoading(false);
    }

    loadUserData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setGameCount(0);
        setCurrentlyPlaying(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncGames]);

  const handleConnectSteam = () => {
    window.location.href = '/api/steam/auth';
  };

  const isSteamConnected = profile?.steam_id != null;
  const showDashboard = user && isSteamConnected;

  // Loading state
  if (isLoading) {
    return (
      <div className='min-h-screen bg-zinc-950 flex flex-col'>
        <Header />
        <main className='pt-16 flex-1 flex items-center justify-center'>
          <div className='space-y-6 text-center'>
            <div className='inline-flex items-center gap-3 px-4 py-2 bg-zinc-800 rounded-lg'>
              <div className='w-8 h-8 bg-zinc-700 rounded animate-pulse' />
              <div className='w-24 h-4 bg-zinc-700 rounded animate-pulse' />
              <span className='text-zinc-700'>·</span>
              <div className='w-16 h-4 bg-zinc-700 rounded animate-pulse' />
            </div>
            <div className='h-12 w-40 mx-auto bg-zinc-800 rounded-lg animate-pulse' />
          </div>
        </main>
      </div>
    );
  }

  // Dashboard view - logged in with Steam connected
  if (showDashboard) {
    return (
      <div className='min-h-screen bg-zinc-950 flex flex-col'>
        <Header />

        <main className='pt-16 flex-1'>
          <section className='max-w-6xl mx-auto px-6 py-12'>
            <div className='flex flex-col items-center text-center'>
              <div className='inline-flex items-center gap-3 px-4 py-2 bg-zinc-800 rounded-lg mb-8'>
                {profile?.steam_avatar && (
                  <Image
                    src={profile.steam_avatar}
                    alt=''
                    width={32}
                    height={32}
                    className='rounded'
                  />
                )}
                <span className='text-zinc-100'>{profile?.steam_username}</span>
                <span className='text-zinc-500'>·</span>
                <span className='text-zinc-400'>{gameCount} games</span>
              </div>

              {isSyncing ? (
                <div className='w-full max-w-sm space-y-3'>
                  <div className='h-2 bg-zinc-800 rounded-full overflow-hidden'>
                    <div
                      className='h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-200'
                      style={{
                        width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className='text-zinc-400 text-sm'>
                    Analyzing games... {syncProgress.current} of {syncProgress.total}
                  </p>
                </div>
              ) : currentlyPlaying ? (
                <CurrentlyPlaying
                  game={currentlyPlaying}
                  onFinish={handleFinishGame}
                  onDrop={handleDropGame}
                  onCancel={handleCancelGame}
                  isLoading={isStatusLoading}
                />
              ) : (
                <Button size='lg'>Pick My Game</Button>
              )}
            </div>
          </section>

          {(shortGames.length > 0 || weekendGames.length > 0) && (
            <section className='max-w-6xl mx-auto px-6 pb-24 space-y-24'>
              {shortGames.length > 0 && (
                <GameCarousel
                  title='Games Under 5 Hours'
                  games={shortGames}
                  onPickGame={handlePickGame}
                />
              )}
              {weekendGames.length > 0 && (
                <GameCarousel
                  title='Games You Can Finish This Weekend'
                  games={weekendGames}
                  onPickGame={handlePickGame}
                />
              )}
            </section>
          )}
        </main>

        <footer className='py-6 border-t border-zinc-800'>
          <div className='max-w-6xl mx-auto px-6 text-center'>
            <p className='text-sm text-zinc-500'>MyBacklog</p>
          </div>
        </footer>
      </div>
    );
  }

  // Landing view - not logged in or no Steam connected
  return (
    <div className='min-h-screen bg-zinc-950 flex flex-col'>
      <Header />

      <main className='pt-16 flex-1'>
        <section className='max-w-4xl mx-auto px-6 py-24 md:py-32'>
          <div className='text-center'>
            <h1 className='text-4xl md:text-5xl font-bold text-zinc-100 leading-tight mb-6'>
              Stop scrolling.{' '}
              <span className='text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400'>
                Start playing.
              </span>
            </h1>
            <p className='text-lg text-zinc-400 mb-10 max-w-xl mx-auto'>
              Connect your Steam library and let us pick your next game based on
              your mood and available time.
            </p>

            {user ? (
              <Button size='lg' onClick={handleConnectSteam}>
                Connect Your Steam
              </Button>
            ) : (
              <Button size='lg' onClick={() => setIsAuthModalOpen(true)}>
                Get Started
              </Button>
            )}
          </div>

          <div className='mt-24 grid md:grid-cols-3 gap-6 text-center'>
            <div className='p-6'>
              <div className='text-3xl font-bold text-zinc-100 mb-2'>1</div>
              <p className='text-zinc-400'>Connect Steam</p>
            </div>
            <div className='p-6'>
              <div className='text-3xl font-bold text-zinc-100 mb-2'>2</div>
              <p className='text-zinc-400'>
                Answer a couple of high-impact questions
              </p>
            </div>
            <div className='p-6'>
              <div className='text-3xl font-bold text-zinc-100 mb-2'>3</div>
              <p className='text-zinc-400'>Get your pick</p>
            </div>
          </div>
        </section>
      </main>

      <footer className='py-6 border-t border-zinc-800'>
        <div className='max-w-4xl mx-auto px-6 text-center'>
          <p className='text-sm text-zinc-500'>MyBacklog</p>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode='signup'
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className='min-h-screen bg-zinc-950' />}>
      <HomeContent />
    </Suspense>
  );
}
