'use client';

import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import { useAuth } from '@/hooks/useAuth';
import { profileAvatar, profileName } from '@/lib/account/identity';
import { profileFigures, ratingSpread } from '@/lib/account/figures';
import { recentActivity } from '@/lib/account/activity';
import { countPlatforms } from '@/lib/games/library-filter';
import { pickedFavorites, toggleFavorite } from '@/lib/account/favorites';
import { useFavoriteGames } from './useFavoriteGames';
import { useLibraryGameDialog } from './useLibraryGameDialog';

/** The library is the Games page's cached list, so it's downloaded once. */
export function useProfilePage() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const {
    data: games = [],
    isPending,
    isLoadingError,
    refetch,
  } = useQuery(queries.gamesList(userId));
  const { data: playing = null } = useQuery(queries.playing(userId));
  // If it can't be read, Recent activity falls back to what the games say.
  const { data: history = [] } = useQuery(queries.history(userId));
  // Without them a start just doesn't say what picked it.
  const { data: picks = [] } = useQuery(queries.playedPicks(userId));

  // The favorites are the player's to pick: none until they do.
  const favoriteGames = useFavoriteGames(userId);
  const picked = pickedFavorites(games, favoriteGames.pickedIds);
  /** The picks the page shows: one hidden since, or gone from the library, drops out. */
  const shownPicks = (ids: readonly number[]) => pickedFavorites(games, ids).map((game) => game.id);
  const { gameDialog, openGame } = useLibraryGameDialog(userId);

  return {
    loading: !!userId && isPending,
    // The first load failed: show that, not an empty profile.
    loadError: isLoadingError,
    retry: () => void refetch(),
    name: profileName(profile?.display_name, profile?.steam_username, user?.email),
    avatar: profileAvatar(profile?.avatar_url, profile?.steam_avatar),
    /** Said under the name; null until the profile is read. */
    username: profile?.username ?? null,
    figures: profileFigures(games),
    /** Games at each rating, 0 to 10; null until enough are rated. */
    ratings: ratingSpread(games),
    favorites: picked,
    /**
     * Until 'ready' the row can't be changed: drawn empty, it would invite
     * picking over the saved ones.
     */
    favoritesState: favoriteGames.ready
      ? ('ready' as const)
      : favoriteGames.failed
        ? ('failed' as const)
        : ('loading' as const),
    retryFavorites: favoriteGames.retry,
    /** Built on the picks the page shows, so one hidden or removed since drops out. */
    favoriteActions: {
      reorder: favoriteGames.set,
      remove: (game: { id: number; name: string }) =>
        favoriteGames.remove(game.id, game.name, shownPicks),
      forgetUndo: favoriteGames.forgetUndo,
    },
    favoritePicker: {
      games,
      pickedIds: picked.map((game) => game.id),
      // From the picks as they are this instant, not as last drawn: three
      // quick clicks pick three games, not just the last.
      onToggle: (gameId: number): number[] => {
        const next = toggleFavorite(shownPicks(favoriteGames.current()), gameId);
        favoriteGames.set(next);
        return next;
      },
    },
    gameDialog,
    openGame,
    activity: recentActivity(games, playing, history, { picks }),
    // Counted as the Games page lists them: hidden games don't count, and a
    // platform with only hidden games isn't listed.
    platforms: [...countPlatforms(games, 'all')]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
