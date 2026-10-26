'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { AddGameModal } from '@/components/games/AddGameModal';
import { createClient } from '@/lib/supabase/client';
import { loadCurrentlyPlaying } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/lib/mutations';

/**
 * The header's Add game button, so a game outside Steam can be added from any
 * page. A new game shows up everywhere at once: the games list (Games, Stats),
 * the carousels, the queue, the playing game and the header's count.
 */
export function AddGameButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const { gamesAndQueue: refreshLibrary } = useInvalidateQueries();

  // Whether a game is being played (Playing isn't offered then). Shares the
  // home page's cache entry and only loads once the dialog is open.
  const { data: playing = null } = useQuery({
    queryKey: queryKeys.games.playing(userId),
    queryFn: () => loadCurrentlyPlaying(createClient(), userId),
    enabled: open,
    staleTime: 30 * 1000,
  });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label="Add game">
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Add game</span>
      </Button>
      {open && (
        <AddGameModal
          isOpen
          onClose={() => setOpen(false)}
          hasPlayingGame={!!playing}
          onAdded={(name) => {
            toast.success(`Added ${name} to your library`);
            refreshLibrary();
          }}
        />
      )}
    </>
  );
}
