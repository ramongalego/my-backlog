'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchArtChoices, saveGameArt, type GameArtChoices } from '@/lib/client/game-art';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from './useGameMutations';

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Choose art for one game: the images to pick from (asked for once the picker
 * is open) and saving a pick. A saved pick shows everywhere the game does, so
 * everything that lists games is read again.
 */
export function useGameArt(gameId: number, open: boolean) {
  const queryClient = useQueryClient();
  const { gamesAndQueue } = useInvalidateQueries();
  const key = queryKeys.gameArt(gameId);

  const choices = useQuery({
    queryKey: key,
    queryFn: () => fetchArtChoices(gameId),
    enabled: open,
    // Each ask goes to SteamGridDB: reopening the picker reuses the answer.
    staleTime: FIVE_MINUTES,
    retry: false,
  });

  const save = useMutation({
    mutationFn: (url: string | null) => saveGameArt(gameId, url),
    onSuccess: (art) => {
      queryClient.setQueryData<GameArtChoices>(key, (old) => old && { ...old, current: art });
      gamesAndQueue();
    },
  });

  return {
    choices: choices.data,
    loading: open && choices.isPending,
    loadError: choices.isError ? (choices.error as Error).message : null,
    retry: () => void choices.refetch(),
    /** Resolves with the art the game now shows; rejects with a message to show. */
    save: save.mutateAsync,
    saving: save.isPending,
  };
}
