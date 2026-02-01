'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { celebrateGameFinished } from '@/lib/confetti';
import type { User } from '@supabase/supabase-js';
import type { Profile, Game, GameWithImage, SyncProgress } from '@/types/games';

interface UseGameLibraryReturn {
  // Auth state
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;

  // Game library state
  gameCount: number;
  shortGames: GameWithImage[];
  weekendGames: GameWithImage[];
  currentlyPlaying: GameWithImage | null;

  // Sync state
  isSyncing: boolean;
  syncProgress: SyncProgress;
  syncingGames: Game[];
  carouselsLoading: boolean;

  // UI state
  isRefreshing: boolean;
  isStatusLoading: boolean;
  celebrationMessage: string | null;

  // Actions
  handlePickGame: (game: GameWithImage) => Promise<void>;
  handleFinishGame: () => Promise<void>;
  handleDropGame: () => Promise<void>;
  handleHideGame: (game: GameWithImage) => Promise<void>;
  handleCancelGame: () => Promise<void>;
  handleRefreshLibrary: () => Promise<void>;
  handleRandomPick: () => Promise<void>;
  handleConnectSteam: () => void;
}

export function useGameLibrary(): UseGameLibraryReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gameCount, setGameCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0 });
  const [syncingGames, setSyncingGames] = useState<Game[]>([]);
  const [carouselsLoading, setCarouselsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shortGamesPool, setShortGamesPool] = useState<GameWithImage[]>([]);
  const [weekendGamesPool, setWeekendGamesPool] = useState<GameWithImage[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<GameWithImage | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);
  const syncingRef = useRef(false);

  // Display only first 10 games from each pool
  const shortGames = shortGamesPool.slice(0, 10);
  const weekendGames = weekendGamesPool.slice(0, 10);

  const syncGames = useCallback(async (games: Game[]) => {
    const BATCH_SIZE = 3;
    let completed = 0;

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async game => {
          try {
            await fetch('/api/games/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appId: game.app_id }),
            });
          } catch (err) {
            console.error(`Failed to sync ${game.name}:`, err);
          } finally {
            completed++;
            setSyncProgress({ current: completed, total: games.length });
          }
        }),
      );
    }
  }, []);

  const handlePickGame = useCallback(async (game: GameWithImage) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: game.app_id, status: 'playing' }),
      });
      setCurrentlyPlaying(game);
      setShortGamesPool(prev => prev.filter(g => g.app_id !== game.app_id));
      setWeekendGamesPool(prev => prev.filter(g => g.app_id !== game.app_id));
    } catch (err) {
      console.error('Failed to pick game:', err);
    }
    setIsStatusLoading(false);
  }, []);

  const handleFinishGame = useCallback(async () => {
    if (!currentlyPlaying) return;
    const finishedGameName = currentlyPlaying.name;
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: currentlyPlaying.app_id,
          status: 'finished',
        }),
      });
      setCurrentlyPlaying(null);
      celebrateGameFinished();
      setCelebrationMessage(finishedGameName);
      setTimeout(() => setCelebrationMessage(null), 3000);
    } catch (err) {
      console.error('Failed to finish game:', err);
    }
    setIsStatusLoading(false);
  }, [currentlyPlaying]);

  const handleDropGame = useCallback(async () => {
    if (!currentlyPlaying) return;
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: currentlyPlaying.app_id,
          status: 'dropped',
        }),
      });
      setCurrentlyPlaying(null);
    } catch (err) {
      console.error('Failed to drop game:', err);
    }
    setIsStatusLoading(false);
  }, [currentlyPlaying]);

  const handleHideGame = useCallback(async (game: GameWithImage) => {
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: game.app_id, status: 'hidden' }),
      });
      setShortGamesPool(prev => prev.filter(g => g.app_id !== game.app_id));
      setWeekendGamesPool(prev => prev.filter(g => g.app_id !== game.app_id));
    } catch (err) {
      console.error('Failed to hide game:', err);
    }
  }, []);

  const handleCancelGame = useCallback(async () => {
    if (!currentlyPlaying) return;
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: currentlyPlaying.app_id,
          status: 'backlog',
        }),
      });
      if (currentlyPlaying.main_story_hours <= 5) {
        setShortGamesPool(prev => [...prev, currentlyPlaying]);
      } else if (currentlyPlaying.main_story_hours <= 12) {
        setWeekendGamesPool(prev => [...prev, currentlyPlaying]);
      }
      setCurrentlyPlaying(null);
    } catch (err) {
      console.error('Failed to cancel game:', err);
    }
    setIsStatusLoading(false);
  }, [currentlyPlaying]);

  const handleRefreshLibrary = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/steam/refresh', { method: 'POST' });
      const data = await res.json();

      if (data.newGames > 0) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to refresh library:', err);
    }
    setIsRefreshing(false);
  }, []);

  const handleRandomPick = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { data: eligibleGames } = await supabase
      .from('games')
      .select('app_id, name, header_image, main_story_hours')
      .eq('user_id', currentUser.id)
      .eq('type', 'game')
      .not('main_story_hours', 'is', null)
      .lte('playtime_forever', 120)
      .contains('categories', ['Single-player'])
      .or('status.is.null,status.eq.backlog');

    if (!eligibleGames || eligibleGames.length === 0) return;

    const randomIndex = Math.floor(Math.random() * eligibleGames.length);
    const randomGame = eligibleGames[randomIndex];
    await handlePickGame(randomGame);
  }, [handlePickGame]);

  const handleConnectSteam = useCallback(() => {
    window.location.href = '/api/steam/auth';
  }, []);

  // Load user data on mount
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
          const { data: allUnsyncedGames } = await supabase
            .from('games')
            .select('app_id, name, type, categories')
            .eq('user_id', user.id)
            .or('metadata_synced.is.null,metadata_synced.eq.false');

          const unsyncedGames = allUnsyncedGames?.filter(g => {
            if (g.type && g.type !== 'game') return false;
            if (g.categories && !g.categories.includes('Single-player')) return false;
            return true;
          });

          if (unsyncedGames && unsyncedGames.length > 0 && !syncingRef.current) {
            setIsLoading(false);
            syncingRef.current = true;
            setIsSyncing(true);
            setSyncingGames(unsyncedGames);
            setSyncProgress({ current: 0, total: unsyncedGames.length });
            await syncGames(unsyncedGames);
            setIsSyncing(false);
            setSyncingGames([]);
            syncingRef.current = false;
          }

          const { count: totalGames } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('type', 'game');

          setGameCount(totalGames || 0);
          setIsLoading(false);

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
            .eq('type', 'game')
            .not('main_story_hours', 'is', null)
            .not('steam_review_weighted', 'is', null)
            .gte('main_story_hours', 1)
            .lte('main_story_hours', 5)
            .lte('playtime_forever', 240)
            .contains('categories', ['Single-player'])
            .or('status.is.null,status.eq.backlog')
            .order('steam_review_weighted', { ascending: false });

          setShortGamesPool(shortGamesData || []);

          const { data: weekendGamesData } = await supabase
            .from('games')
            .select('app_id, name, header_image, main_story_hours')
            .eq('user_id', user.id)
            .eq('type', 'game')
            .not('main_story_hours', 'is', null)
            .not('steam_review_weighted', 'is', null)
            .gt('main_story_hours', 5)
            .lte('main_story_hours', 12)
            .lte('playtime_forever', 240)
            .contains('categories', ['Single-player'])
            .or('status.is.null,status.eq.backlog')
            .order('steam_review_weighted', { ascending: false });

          setWeekendGamesPool(weekendGamesData || []);
          setCarouselsLoading(false);
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

  return {
    user,
    profile,
    isLoading,
    gameCount,
    shortGames,
    weekendGames,
    currentlyPlaying,
    isSyncing,
    syncProgress,
    syncingGames,
    carouselsLoading,
    isRefreshing,
    isStatusLoading,
    celebrationMessage,
    handlePickGame,
    handleFinishGame,
    handleDropGame,
    handleHideGame,
    handleCancelGame,
    handleRefreshLibrary,
    handleRandomPick,
    handleConnectSteam,
  };
}
