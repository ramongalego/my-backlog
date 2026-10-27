'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gamepad2, Loader2, Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { playsOnConsole, STEAM_PLATFORM } from '@/lib/games/consoles';

// The statuses the add dialog offers; a Steam game in another (won't play,
// hidden) starts on backlog.
const ADDABLE = ['backlog', 'playing', 'finished', 'dropped'] as const;

// Wait for a pause in typing before searching.
const SEARCH_DELAY_MS = 300;
// How long a result stays highlighted before its details are fetched, so
// arrowing or moving the mouse past a result doesn't fetch it.
const PREFETCH_DELAY_MS = 200;
// The search's exit animation (animate-drop-out).
const CLOSE_MS = 140;

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
  /** `movedTo` is set when the game was already on Steam and moved to that console. */
  onAdded: (name: string, status: AddStatus, warning?: string, movedTo?: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [searchedFor, setSearchedFor] = useState('');
  const [searching, setSearching] = useState(false);
  // Kept with the text it was for, so it doesn't show against newer text.
  const [searchError, setSearchError] = useState<{ text: string; message: string } | null>(null);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<GameSearchResult | null>(null);
  // Closing the search plays its exit first; picking a game doesn't.
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return onClose();
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // The consoles you've added games on (to suggest them first), plus the game
  // being played.
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
        if (!controller.signal.aborted) setSearchError({ text, message: (err as Error).message });
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
  const errorMessage = searchError?.text === text ? searchError.message : null;

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
    // Already in the library (from Steam or added by hand): adding it again
    // moves that entry to the console you pick, so it's only listed once.
    const existing = picked.libraryGame;
    const fromSteam = !!existing?.fromSteam;
    // The console it's on now, which the picker starts from.
    const currentConsole =
      existing && playsOnConsole(existing.platform) ? existing.platform! : null;
    const preferred = currentConsole ? [currentConsole, ...usedConsoles] : usedConsoles;
    const consoles = orderConsoles(
      (details?.platforms ?? picked.platforms)
        .map(shortPlatformName)
        // Owned on Steam: PC is where it already is.
        .filter((name) => !fromSteam || name !== STEAM_PLATFORM),
      preferred,
    );
    // Moving a game starts from where it is: its status, and its date, notes
    // and rating if it's finished or dropped.
    const existingStatus = ADDABLE.find((s) => s === existing?.status);
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
        // Adding a game that isn't out yet says so, as its card will.
        releaseDate={details?.release_date}
        initialStatus={existingStatus ?? 'backlog'}
        initialDate={existing?.date?.slice(0, 10) ?? null}
        initialNotes={existing?.notes}
        initialRating={existing?.rating}
        adding={{
          consoles,
          defaultConsole: defaultConsole(consoles, preferred),
          fromSteam,
          movedTo: fromSteam ? currentConsole : null,
          inLibraryOn: existing && !fromSteam ? currentConsole : null,
          year: picked.year,
          // Not when the game being moved is the one you're playing.
          playingName: existing && playing?.id === existing.id ? null : (playing?.name ?? null),
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
            onAdded(added.name, status, added.warning, added.moved ? platform : undefined);
          },
        }}
      />
    );
  }

  const listId = 'add-game-results';
  const showEmpty = showResults && !errorMessage && results.length === 0;
  const showList = showResults && results.length > 0;
  return (
    <Modal isOpen onClose={close} ariaLabel="Add a game" size="xl" bare closing={closing}>
      <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900 shadow-2xl shadow-black/50">
        {/* The search field is the panel's top edge, not a box inside it. */}
        <div className="flex h-14 items-center gap-3 px-4">
          {searching && text.length >= 2 ? (
            <Loader2 className="w-5 h-5 shrink-0 text-ink-400 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="w-5 h-5 shrink-0 text-ink-400" aria-hidden="true" />
          )}
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search for a game to add"
            aria-label="Search for a game"
            data-autofocus
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink-50 caret-accent-400 placeholder:text-ink-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="cursor-pointer rounded-md p-1 text-ink-500 transition-colors hover:text-ink-100"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {/* Escape closes it; on a phone, there's no key to press. */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="cursor-pointer rounded-md text-sm text-ink-400 transition-colors hover:text-ink-100 sm:border sm:border-ink-700 sm:px-1.5 sm:py-0.5 sm:text-xs sm:font-medium"
          >
            <span className="sm:hidden">Cancel</span>
            <kbd className="hidden font-sans sm:inline">Esc</kbd>
          </button>
        </div>

        {/* Result counts for screen readers; the list itself is the visual cue. */}
        <p className="sr-only" aria-live="polite">
          {showResults && !errorMessage
            ? results.length === 0
              ? 'No games found'
              : `${results.length} ${results.length === 1 ? 'result' : 'results'}`
            : ''}
        </p>

        {errorMessage && (
          <p className="border-t border-ink-800 px-4 py-3 text-sm text-rose-400" role="alert">
            {errorMessage}
          </p>
        )}

        {showEmpty && (
          <p className="border-t border-ink-800 px-4 py-8 text-center text-sm text-ink-400 animate-result-in motion-reduce:animate-none">
            No games found for “{searchedFor}”. Try the name without subtitles or edition.
          </p>
        )}

        {showList && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Search results"
            className="max-h-[min(26rem,60vh)] overflow-y-auto border-t border-ink-800 p-2"
          >
            {results.map((game, i) => {
              const owned = game.libraryGame;
              return (
                <li
                  key={game.igdbId}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => setPicked(game)}
                  onMouseMove={() => setActive(i)}
                  // Each new result settles in just after the one above it.
                  style={{ animationDelay: `${Math.min(i, 7) * 25}ms` }}
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors animate-result-in motion-reduce:animate-none ${
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
                    {owned && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-300">
                        <Check className="w-3 h-3" aria-hidden="true" />
                        {!playsOnConsole(owned.platform)
                          ? 'In your Steam library'
                          : owned.fromSteam
                            ? `In your library on ${owned.platform}, from Steam`
                            : `In your library on ${owned.platform}`}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 px-1 text-xs text-ink-300">
        {profile?.steam_id
          ? 'For games outside your Steam library, on any console or store'
          : 'Any game you own, on any console or store'}
      </p>
    </Modal>
  );
}
