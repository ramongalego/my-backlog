'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGameArt } from '@/hooks/useGameArt';
import { COVER_ASPECT } from '@/components/games/CoverArt';
import { GameArt } from '@/components/games/GameArt';

const TILE = `group relative block w-full ${COVER_ASPECT} cursor-pointer overflow-hidden rounded-lg bg-ink-800 outline-offset-2 transition-shadow`;
const PICKED = 'ring-2 ring-ink-50 ring-offset-2 ring-offset-ink-900';
const UNPICKED = 'ring-1 ring-inset ring-white/8 hover:ring-white/30';

/** The mark on the tile that's picked. */
function Picked() {
  return (
    <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink-50 text-ink-950">
      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
    </span>
  );
}

/**
 * Choose art: the game's original art and SteamGridDB's other images for it,
 * as tiles to pick from. Picking one shows it in the dialog's header
 * (`onPreview`) before anything is saved; "Use this art" saves it and hands
 * back what the game now shows (`onDone`).
 */
export function ArtPicker({
  gameId,
  shown,
  onPreview,
  onDone,
  onCancel,
}: {
  gameId: number;
  /** The art the game shows now. */
  shown: string | null;
  onPreview: (url: string | null) => void;
  onDone: (art: string | null) => void;
  onCancel: () => void;
}) {
  const art = useGameArt(gameId, true);
  const [picked, setPicked] = useState(shown);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The button that opened the picker is gone while it's open: focus moves to
  // the picker's heading, so the keyboard and screen readers start from it.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const pick = (url: string | null) => {
    setPicked(url);
    setSaveError(null);
    onPreview(url);
  };

  const use = async () => {
    setSaveError(null);
    try {
      // The original is saved as "no choice", so syncs keep it up to date.
      onDone(await art.save(picked === art.choices?.original ? null : picked));
    } catch (err) {
      setSaveError((err as Error).message);
    }
  };

  const original = art.choices?.original ?? null;
  const choices = art.choices?.choices ?? [];
  // The original is offered whenever there's one to go back to.
  const showOriginal = !!art.choices && (original !== null || shown !== null);

  return (
    <div className="mt-4 space-y-4">
      <div>
        <h3
          ref={heading}
          tabIndex={-1}
          className="text-sm font-semibold text-ink-200 focus:outline-none"
        >
          Choose art
        </h3>
        <p className="mt-1 text-sm text-ink-400">
          Community art from SteamGridDB. Your pick shows everywhere this game does.
        </p>
      </div>

      {art.loading && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="art-loading">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${COVER_ASPECT} animate-pulse rounded-lg bg-ink-800`} />
          ))}
        </div>
      )}

      {art.loadError && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm text-rose-400" role="alert">
            {art.loadError}
          </p>
          <Button variant="secondary" size="sm" onClick={art.retry} className="cursor-pointer">
            Try again
          </Button>
        </div>
      )}

      {art.choices && (
        <>
          {/* The padding keeps a picked tile's ring inside the scrolling box. */}
          <ul className="-m-1 grid max-h-[21rem] grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3">
            {showOriginal && (
              <li>
                <button
                  type="button"
                  aria-pressed={picked === original}
                  aria-label="Original art"
                  onClick={() => pick(original)}
                  className={`${TILE} ${picked === original ? PICKED : UNPICKED}`}
                >
                  {original ? (
                    <GameArt src={original} alt="" sizes="(max-width: 640px) 50vw, 180px" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Gamepad2 className="h-6 w-6 text-ink-600" aria-hidden="true" />
                    </span>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-ink-950/90 px-2 py-0.5 text-xs font-medium text-ink-200">
                    Original
                  </span>
                  {picked === original && <Picked />}
                </button>
              </li>
            )}
            {choices.map((choice, i) => (
              <li key={choice.url}>
                <button
                  type="button"
                  aria-pressed={picked === choice.url}
                  aria-label={`Art ${i + 1} of ${choices.length}`}
                  onClick={() => pick(choice.url)}
                  className={`${TILE} ${picked === choice.url ? PICKED : UNPICKED}`}
                >
                  {/* SteamGridDB's own small copy, as it is: a picker full of
                      tiles isn't worth resizing each one on the server. */}
                  <Image
                    src={choice.thumb}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, 180px"
                    className="object-cover"
                    draggable={false}
                  />
                  {picked === choice.url && <Picked />}
                </button>
              </li>
            ))}
          </ul>
          {choices.length === 0 && (
            <p className="mt-4 text-sm text-ink-400">SteamGridDB has no other art for this game.</p>
          )}
        </>
      )}

      {saveError && (
        <p className="text-sm text-rose-400" role="alert">
          {saveError}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={art.saving}
          className="flex-1 cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={use}
          isLoading={art.saving}
          disabled={!art.choices || picked === shown}
          className="flex-1 cursor-pointer"
        >
          Use this art
        </Button>
      </div>
    </div>
  );
}
