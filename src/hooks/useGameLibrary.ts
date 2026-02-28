'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { celebrateGameFinished } from '@/lib/confetti';
import type { User } from '@supabase/supabase-js';
import type { Profile, Game, GameWithImage, SyncProgress } from '@/types/games';
import type { GameSummaryData } from '@/components/games/GameSummaryModal';
import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';
import { fetchQueuedAppIds, addToQueue } from '@/lib/games/queue';
import { toast } from 'sonner';

interface StatusModal {
  action: 'finished' | 'dropped';
}

interface UseGameLibraryReturn {
  // Auth state
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;

  // Game library state
  gameCount: number;
  historyCount: number;
  shortGames: GameWithImage[];
  weekendGames: GameWithImage[];
  highlyRatedGames: GameWithImage[];
  currentlyPlaying: GameWithImage | null;

  // Sync state
  isSyncing: boolean;
  syncProgress: SyncProgress;
  syncingGames: Game[];
  carouselsLoading: boolean;

  // UI state
  isStatusLoading: boolean;
  statusModal: StatusModal | null;
  gameSummary: GameSummaryData | null;
  queuedAppIds: Set<number>;
  carouselModal: { game: GameWithImage } | null;

  // Actions
  handlePickGame: (game: GameWithImage) => Promise<void>;
  handleFinishGame: () => void;
  handleDropGame: () => void;
  handleQueueGame: (game: GameWithImage) => Promise<void>;
  handleOpenCarouselDetail: (game: GameWithImage) => void;
  handleConfirmCarouselDetail: (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => Promise<void>;
  handleCloseCarouselModal: () => void;
  handleCancelGame: () => Promise<void>;
  handleRandomPick: () => Promise<void>;
  handleConnectSteam: () => void;
  handleConfirmStatusChange: (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => Promise<void>;
  handleCloseStatusModal: () => void;
  handleCloseSummary: () => void;
}

export function useGameLibrary(): UseGameLibraryReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gameCount, setGameCount] = useState<number>(0);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0 });
  const [syncingGames, setSyncingGames] = useState<Game[]>([]);
  const [carouselsLoading, setCarouselsLoading] = useState(true);
  const [shortGamesPool, setShortGamesPool] = useState<GameWithImage[]>([]);
  const [weekendGamesPool, setWeekendGamesPool] = useState<GameWithImage[]>([]);
  const [highlyRatedGamesPool, setHighlyRatedGamesPool] = useState<GameWithImage[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<GameWithImage | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);
  const [queuedAppIds, setQueuedAppIds] = useState<Set<number>>(new Set());
  const [carouselModal, setCarouselModal] = useState<{ game: GameWithImage } | null>(null);
  const syncingRef = useRef(false);

  // Display only first 10 games from each pool
  const shortGames = shortGamesPool.slice(0, 10);
  const weekendGames = weekendGamesPool.slice(0, 10);

  // Deduplicate highly rated games - exclude games shown in other carousels
  const excludedAppIds = new Set([
    ...shortGames.map((g) => g.app_id),
    ...weekendGames.map((g) => g.app_id),
  ]);
  const highlyRatedGames = highlyRatedGamesPool
    .filter((g) => !excludedAppIds.has(g.app_id))
    .slice(0, 10);

  const syncGames = useCallback(async (games: Game[]) => {
    const BATCH_SIZE = 3;
    let completed = 0;

    const syncOne = async (game: Game): Promise<void> => {
      let attempts = 0;
      while (attempts < 5) {
        try {
          const response = await fetch('/api/games/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId: game.app_id, name: game.name }),
          });
          if (response.status === 429) {
            const retryAfter = Math.min(
              parseInt(response.headers.get('Retry-After') ?? '10', 10),
              15,
            );
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            attempts++;
            continue;
          }
        } catch (err) {
          console.error(`Failed to sync ${game.name}:`, err);
        }
        break;
      }
      completed++;
      setSyncProgress({ current: completed, total: games.length });
    };

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(syncOne));
    }
  }, []);

  const handlePickGame = useCallback(async (game: GameWithImage) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsStatusLoading(true);
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: game.app_id,
          status: 'playing',
          started_at: new Date().toISOString(),
        }),
      });
      setCurrentlyPlaying(game);
      setShortGamesPool((prev) => prev.filter((g) => g.app_id !== game.app_id));
      setWeekendGamesPool((prev) => prev.filter((g) => g.app_id !== game.app_id));
      setHighlyRatedGamesPool((prev) => prev.filter((g) => g.app_id !== game.app_id));
    } catch (err) {
      console.error('Failed to pick game:', err);
    }
    setIsStatusLoading(false);
  }, []);

  const handleFinishGame = useCallback(() => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'finished' });
  }, [currentlyPlaying]);

  const handleDropGame = useCallback(() => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'dropped' });
  }, [currentlyPlaying]);

  const handleQueueGame = useCallback(async (game: GameWithImage) => {
    const ok = await addToQueue(game.app_id);
    if (ok) {
      setQueuedAppIds((prev) => new Set([...prev, game.app_id]));
      toast.success(`${game.name} added to the queue!`);
    }
  }, []);

  const handleOpenCarouselDetail = useCallback((game: GameWithImage) => {
    setCarouselModal({ game });
  }, []);

  const handleCloseCarouselModal = useCallback(() => setCarouselModal(null), []);

  const handleConfirmCarouselDetail = useCallback(
    async (status: string, date: string, notes: string, rating: number | null) => {
      if (!carouselModal) return;
      const { game } = carouselModal;
      setCarouselModal(null);

      if (status === 'playing') {
        await handlePickGame(game);
        return;
      }

      try {
        await fetch('/api/games/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: game.app_id,
            status,
            ...(status === 'finished' ? { finishedAt: date } : {}),
            ...(status === 'dropped' ? { droppedAt: date } : {}),
            notes,
            rating,
          }),
        });
        setShortGamesPool((prev) => prev.filter((g) => g.app_id !== game.app_id));
        setWeekendGamesPool((prev) => prev.filter((g) => g.app_id !== game.app_id));
        setHighlyRatedGamesPool((prev) => prev.filter((g) => g.app_id !== game.app_id));
      } catch (err) {
        console.error('Failed to update game status:', err);
      }
    },
    [carouselModal, handlePickGame],
  );

  const handleConfirmStatusChange = useCallback(
    async (status: string, date: string, notes: string, rating: number | null) => {
      if (!currentlyPlaying) return;
      const finishedGame = currentlyPlaying;
      setStatusModal(null);
      setIsStatusLoading(true);
      try {
        await fetch('/api/games/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: finishedGame.app_id,
            status,
            ...(status === 'finished' ? { finishedAt: date } : {}),
            ...(status === 'dropped' ? { droppedAt: date } : {}),
            notes,
            rating,
          }),
        });

        const supabase = createClient();
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        let promoted: GameWithImage | null = null;
        let gamesFinished = 0;
        let totalGames = 0;

        if (currentUser) {
          const [{ count: finishedCount }, { count: totalCount }, promotedGame] = await Promise.all(
            [
              supabase
                .from('games')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .eq('type', 'game')
                .eq('status', 'finished'),
              supabase
                .from('games')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .eq('type', 'game')
                .neq('status', 'hidden'),
              promoteNextFromQueue(currentUser.id, supabase),
            ],
          );
          promoted = promotedGame;
          gamesFinished = finishedCount ?? 0;
          totalGames = totalCount ?? 0;
        }

        setCurrentlyPlaying(promoted);

        if (status === 'finished') {
          setGameSummary({
            gameName: finishedGame.name,
            headerImage: finishedGame.header_image,
            playtimeMinutes: finishedGame.playtime_forever,
            mainStoryHours:
              finishedGame.main_story_hours > 0 ? finishedGame.main_story_hours : null,
            rating,
            gamesFinished,
            totalGames,
            backlogHoursRemoved:
              finishedGame.main_story_hours > 0 ? finishedGame.main_story_hours : null,
            nextGame: promoted?.name ?? null,
          });
          celebrateGameFinished();
        }
      } catch (err) {
        console.error(`Failed to ${status} game:`, err);
      }
      setIsStatusLoading(false);
    },
    [currentlyPlaying],
  );

  const handleCloseStatusModal = useCallback(() => setStatusModal(null), []);
  const handleCloseSummary = useCallback(() => setGameSummary(null), []);

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
        setShortGamesPool((prev) => [...prev, currentlyPlaying]);
      } else if (currentlyPlaying.main_story_hours <= 12) {
        setWeekendGamesPool((prev) => [...prev, currentlyPlaying]);
      }
      setCurrentlyPlaying(null);
    } catch (err) {
      console.error('Failed to cancel game:', err);
    }
    setIsStatusLoading(false);
  }, [currentlyPlaying]);

  const runRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/steam/refresh', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      localStorage.setItem('playtime_refresh_at', Date.now().toString());
      if (data.newGames > 0) {
        window.location.reload();
        return;
      }
      // No new games — re-fetch currently playing to show updated playtime
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: playingGame } = await supabase
          .from('games')
          .select(
            'app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, deck_compat',
          )
          .eq('user_id', currentUser.id)
          .eq('status', 'playing')
          .single();
        if (playingGame) setCurrentlyPlaying(playingGame);
      }
    } catch (err) {
      console.error('Failed to refresh library:', err);
    }
  }, []);

  const handleRandomPick = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { data: eligibleGames } = await supabase
      .from('games')
      .select('app_id, name, header_image, main_story_hours, playtime_forever')
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

          const unsyncedGames = allUnsyncedGames?.filter((g) => {
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
            .eq('type', 'game')
            .neq('status', 'hidden');

          setGameCount(totalGames || 0);
          setIsLoading(false);

          const { data: playingGame } = await supabase
            .from('games')
            .select(
              'app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, deck_compat',
            )
            .eq('user_id', user.id)
            .eq('status', 'playing')
            .single();

          if (playingGame) {
            setCurrentlyPlaying(playingGame);
          }

          const { data: shortGamesData } = await supabase
            .from('games')
            .select(
              'app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, deck_compat',
            )
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
            .select(
              'app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, deck_compat',
            )
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

          // Highly rated games the user has never played (0 playtime)
          const { data: highlyRatedData } = await supabase
            .from('games')
            .select(
              'app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, deck_compat',
            )
            .eq('user_id', user.id)
            .eq('type', 'game')
            .not('steam_review_weighted', 'is', null)
            .eq('playtime_forever', 0)
            .contains('categories', ['Single-player'])
            .or('status.is.null,status.eq.backlog')
            .order('steam_review_weighted', { ascending: false })
            .limit(20); // Fetch extra to account for deduplication

          setHighlyRatedGamesPool(highlyRatedData || []);
          setCarouselsLoading(false);

          setQueuedAppIds(await fetchQueuedAppIds());

          const { count: finishedOrDropped } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('type', 'game')
            .in('status', ['finished', 'dropped']);

          setHistoryCount(finishedOrDropped ?? 0);

          // Auto-refresh playtime if it's been more than 1 hour
          const lastRefresh = localStorage.getItem('playtime_refresh_at');
          const oneHour = 60 * 60 * 1000;
          if (!lastRefresh || Date.now() - parseInt(lastRefresh) > oneHour) {
            runRefresh();
          }

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
  }, [syncGames, runRefresh]);

  return {
    user,
    profile,
    isLoading,
    gameCount,
    historyCount,
    shortGames,
    weekendGames,
    highlyRatedGames,
    currentlyPlaying,
    isSyncing,
    syncProgress,
    syncingGames,
    carouselsLoading,
    isStatusLoading,
    statusModal,
    gameSummary,
    queuedAppIds,
    carouselModal,
    handlePickGame,
    handleFinishGame,
    handleDropGame,
    handleQueueGame,
    handleOpenCarouselDetail,
    handleConfirmCarouselDetail,
    handleCloseCarouselModal,
    handleCancelGame,
    handleRandomPick,
    handleConnectSteam,
    handleConfirmStatusChange,
    handleCloseStatusModal,
    handleCloseSummary,
  };
}
