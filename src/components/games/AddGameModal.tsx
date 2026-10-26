'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gamepad2, Loader2, Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { fieldClass } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { loadCurrentlyPlaying, loadManualGames } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import {
  addManualGame,
  getGameDetails,
  searchGames,
  shortPlatformName,
  type GameSearchResult,
} from '@/lib/games/manual';
import { GameDetailModal, type AddStatus } from './GameStatusModal';
import { defaultConsole, orderConsoles } from './ConsolePicker';

// Wait for a pause in typing before searching.
const SEARCH_DELAY_MS = 300;
// How long a result stays highlighted before its details are fetched, so
// arrowing or moving the mouse past a result doesn't fetch it.
const PREFETCH_DELAY_MS = 200;

const detailsQuery = (igdbId: number) => ({
  queryKey: queryKeys.igdb.game(igdbId),
  queryFn: () => getGameDetails(igdbId),
  staleTime: 10 * 60 * 1000,
  retry: 1,
});

function BoxArt({ src }: { src: string | null }) {
  return (
    <div className="relative w-10 h-14 shrink-0 overflow-hidden rounded-md bg-ink-800">
      {src ? (
        <Image src={src} alt="" fill sizes="40px" className="object-cover" />
      ) : (
        <Gamepad2 className="absolute inset-0 m-auto w-4 h-4 text-ink-600" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * Adds a game from outside Steam: search IGDB, then the chosen game opens in
 * the same detail dialog every game uses, with its console, status (finished
 * games included), hours and "Add to library".
 */
export function AddGameModal({
  userId,
  initialQuery = '',
  onClose,
  onAdded,
}: {
  userId: string;
  initialQuery?: string;
  onClose: () => void;
  onAdded: (name: string, status: AddStatus, warning?: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [searchedFor, setSearchedFor] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<GameSearchResult | null>(null);
  const queryClient = useQueryClient();

  // Games you've already added by hand (to mark them in results) and the
  // consoles you use (to suggest them first), plus the game being played.
  const { data: manualGames = [] } = useQuery({
    queryKey: queryKeys.games.manual(userId),
    queryFn: () => loadManualGames(createClient(), userId),
  });
  const { data: playing = null } = useQuery({
    queryKey: queryKeys.games.playing(userId),
    queryFn: () => loadCurrentlyPlaying(createClient(), userId),
    staleTime: 30 * 1000,
  });
  const usedConsoles = [...new Set(manualGames.flatMap((g) => (g.platform ? [g.platform] : [])))];
  const ownedOn = (igdbId: number) =>
    manualGames
      .filter((g) => g.igdb_id === igdbId)
      .flatMap((g) => (g.platform ? [g.platform] : []));

  const text = query.trim();
  useEffect(() => {
    if (text.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        setResults(await searchGames(text, controller.signal));
        setSearchedFor(text);
        setActive(0);
      } catch (err) {
        if (!controller.signal.aborted) setSearchError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  // The picked game's wide art and full platform list. Until they arrive the
  // header is a placeholder (not the box art, which would be swapped out a
  // moment later) and the search result's platforms stand in.
  const { data: details, isPending: detailsPending } = useQuery({
    ...detailsQuery(picked?.igdbId ?? 0),
    enabled: !!picked,
  });

  const showResults = text.length >= 2 && searchedFor === text;

  // Fetch the highlighted result's details while you look, so they're
  // usually there by the time you pick it.
  const activeId = showResults ? results[active]?.igdbId : undefined;
  useEffect(() => {
    if (activeId === undefined || picked) return;
    const timer = setTimeout(
      () => void queryClient.prefetchQuery(detailsQuery(activeId)),
      PREFETCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [activeId, picked, queryClient]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || results.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setPicked(results[active]);
    }
  };

  if (picked) {
    const consoles = orderConsoles(
      (details?.platforms ?? picked.platforms).map(shortPlatformName),
      usedConsoles,
    );
    return (
      <GameDetailModal
        // A new game starts the form over (console, status, hours).
        key={picked.igdbId}
        isOpen
        onClose={onClose}
        gameName={picked.name}
        // If the details fail, the box art is all there is.
        headerImage={details ? details.header_image : picked.cover}
        headerLoading={detailsPending}
        initialStatus="backlog"
        adding={{
          consoles,
          defaultConsole: defaultConsole(consoles, usedConsoles),
          year: picked.year,
          playingName: playing?.name ?? null,
          onChangeGame: () => setPicked(null),
          onAdd: async ({ status, platform, hours, date, notes, rating }) => {
            const added = await addManualGame({
              igdbId: picked.igdbId,
              platform,
              status,
              hoursPlayed: hours,
              date: date || undefined,
              notes: notes || undefined,
              rating,
            });
            onAdded(added.name, status, added.warning);
          },
        }}
      />
    );
  }

  const listId = 'add-game-results';
  return (
    <Modal isOpen onClose={onClose} title="Add a game" size="xl" align="top">
      <div className="space-y-3">
        <p className="text-sm text-ink-400">
          For games outside your Steam library, on any console or store.
        </p>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500"
            aria-hidden="true"
          />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={showResults && results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              showResults && results.length > 0 ? `${listId}-${active}` : undefined
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search for a game"
            aria-label="Search for a game"
            data-autofocus
            className={`${fieldClass()} h-10 pl-9 pr-16 text-sm`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searching && (
              <Loader2 className="w-4 h-4 text-ink-500 animate-spin" aria-hidden="true" />
            )}
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="cursor-pointer p-1 rounded text-ink-500 hover:text-ink-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Result counts for screen readers; the list itself is the visual cue. */}
        <p className="sr-only" aria-live="polite">
          {showResults && !searchError
            ? results.length === 0
              ? 'No games found'
              : `${results.length} ${results.length === 1 ? 'result' : 'results'}`
            : ''}
        </p>

        {searchError && text.length >= 2 && (
          <p className="text-sm text-rose-400" role="alert">
            {searchError}
          </p>
        )}

        {showResults && !searchError && results.length === 0 && (
          <p className="text-sm text-ink-400 py-6 text-center">
            No games found for “{searchedFor}”. Try the name without subtitles or edition.
          </p>
        )}

        {showResults && results.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Search results"
            className="max-h-[22rem] overflow-y-auto -mx-2 px-2"
          >
            {results.map((game, i) => {
              const owned = ownedOn(game.igdbId);
              return (
                <li
                  key={game.igdbId}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => setPicked(game)}
                  onMouseMove={() => setActive(i)}
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                    i === active ? 'bg-ink-800' : ''
                  }`}
                >
                  <BoxArt src={game.cover} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-100 truncate">
                      {game.name}
                      {game.year && (
                        <span className="text-ink-400 font-normal tabular-nums"> {game.year}</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-400 truncate">
                      {game.platforms.map(shortPlatformName).join(', ')}
                    </p>
                    {owned.length > 0 && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-300">
                        <Check className="w-3 h-3" aria-hidden="true" />
                        In your library on {owned.join(', ')}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
