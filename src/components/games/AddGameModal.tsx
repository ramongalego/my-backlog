'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Gamepad2, Loader2, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FIELD_LABEL, fieldClass } from '@/components/ui/Input';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import {
  addManualGame,
  searchGames,
  shortPlatformName,
  type GameSearchResult,
} from '@/lib/games/manual';

type AddStatus = 'backlog' | 'queue' | 'playing';

// Wait for a pause in typing before searching.
const SEARCH_DELAY_MS = 300;

function BoxArt({ src, className }: { src: string | null; className: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded bg-ink-800 ${className}`}>
      {src ? (
        <Image src={src} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <Gamepad2 className="absolute inset-0 m-auto w-4 h-4 text-ink-600" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * Adds a game that isn't on Steam: search IGDB, pick the game, then the
 * console it's on, where it goes and (optionally) how long you've played.
 */
export function AddGameModal({
  isOpen,
  onClose,
  onAdded,
  hasPlayingGame,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (name: string) => void;
  /** Starting a game would replace the one being played, so Playing isn't offered then. */
  hasPlayingGame: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<GameSearchResult | null>(null);
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState<AddStatus>('backlog');
  const [hours, setHours] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        setResults(await searchGames(text, controller.signal));
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
  }, [query]);

  const choose = (game: GameSearchResult) => {
    setSelected(game);
    setAddError(null);
    // Most likely the console you play on rather than PC, if it's on one.
    const platforms = game.platforms.map(shortPlatformName);
    setPlatform(platforms.find((p) => p !== 'PC') ?? platforms[0] ?? '');
  };

  const add = async () => {
    if (!selected) return;
    const hoursPlayed = hours.trim() === '' ? undefined : Number(hours);
    if (hoursPlayed !== undefined && !(hoursPlayed >= 0)) {
      setAddError('Hours played must be a number');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const added = await addManualGame({
        igdbId: selected.igdbId,
        platform: platform.trim(),
        status,
        hoursPlayed,
      });
      onAdded(added.name);
      onClose();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const platformOptions = [...new Set(selected?.platforms.map(shortPlatformName) ?? [])];
  const statusOptions = [
    { value: 'backlog' as const, label: 'Backlog' },
    { value: 'queue' as const, label: 'Queue' },
    ...(hasPlayingGame ? [] : [{ value: 'playing' as const, label: 'Playing' }]),
  ];
  const showResults = query.trim().length >= 2;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a game" size="xl">
      {!selected ? (
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
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a game"
              aria-label="Search for a game"
              data-autofocus
              className={`${fieldClass()} h-10 pl-9 pr-9 text-sm`}
            />
            {searching && (
              <Loader2
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 animate-spin"
                aria-hidden="true"
              />
            )}
          </div>

          {searchError && showResults && (
            <p className="text-sm text-rose-400" role="alert">
              {searchError}
            </p>
          )}

          {showResults && !searching && !searchError && results.length === 0 && (
            <p className="text-sm text-ink-400 py-4 text-center">No games found</p>
          )}

          {showResults && results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto -mx-2" aria-label="Search results">
              {results.map((game) => (
                <li key={game.igdbId}>
                  <button
                    onClick={() => choose(game)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-ink-800 cursor-pointer transition-colors"
                  >
                    <BoxArt src={game.cover} className="w-9 h-12" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-100 truncate">
                        {game.name}
                        {game.year && (
                          <span className="text-ink-400 font-normal"> ({game.year})</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-400 truncate">
                        {game.platforms.map(shortPlatformName).join(', ')}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <BoxArt src={selected.cover} className="w-12 h-16" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink-100">{selected.name}</p>
              {selected.year && <p className="text-sm text-ink-400">{selected.year}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Change
            </Button>
          </div>

          <div>
            <p className={FIELD_LABEL}>Platform</p>
            {platformOptions.length > 0 ? (
              <ToggleGroup
                label="Platform"
                options={platformOptions.map((p) => ({ value: p, label: p }))}
                value={platform}
                onChange={setPlatform}
              />
            ) : (
              <input
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="e.g. Switch 2"
                aria-label="Platform"
                maxLength={60}
                className={`${fieldClass()} h-10 px-3 text-sm`}
              />
            )}
          </div>

          <div>
            <p className={FIELD_LABEL}>Add to</p>
            <ToggleGroup
              label="Add to"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
          </div>

          <div>
            <label className={FIELD_LABEL} htmlFor="add-game-hours">
              Hours played <span className="text-ink-500 font-normal">(optional)</span>
            </label>
            <input
              id="add-game-hours"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0"
              className={`${fieldClass()} h-10 px-3 text-sm`}
            />
          </div>

          {addError && (
            <p className="text-sm text-rose-400" role="alert">
              {addError}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={adding} className="flex-1">
              Cancel
            </Button>
            <Button onClick={add} isLoading={adding} disabled={!platform.trim()} className="flex-1">
              {adding ? 'Adding…' : 'Add game'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
