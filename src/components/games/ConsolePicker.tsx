'use client';

import { useState } from 'react';
import { FIELD_LABEL, fieldClass } from '@/components/ui/Input';
import { chipClass } from '@/components/ui/ToggleGroup';

// After your own consoles: current hardware, then older mainstream consoles,
// newest first. IGDB lists platforms in no useful order ("Satellaview", a
// Japan-only add-on, before "SNES"); anything not named here sorts last.
const KNOWN_CONSOLES = [
  'Switch 2',
  'PS5',
  'Xbox Series X|S',
  'PC',
  'Switch',
  'PS4',
  'Xbox One',
  'Steam Deck',
  'Wii U',
  'New 3DS',
  '3DS',
  'PS Vita',
  'PS3',
  'Xbox 360',
  'Wii',
  'DS',
  'PSP',
  'PS2',
  'Xbox',
  'GameCube',
  'GBA',
  'N64',
  'PS1',
  'SNES',
  'Mega Drive',
  'NES',
];
const VISIBLE = 4;

/**
 * The consoles to offer, best guess first: the ones you've added games on
 * (most recent first), then known consoles newest first, then the rest.
 */
export function orderConsoles(options: string[], used: string[]): string[] {
  const rank = (name: string) => {
    const usedAt = used.indexOf(name);
    if (usedAt !== -1) return usedAt;
    const knownAt = KNOWN_CONSOLES.indexOf(name);
    return knownAt !== -1 ? 100 + knownAt : 1000;
  };
  return [...new Set(options)]
    .map((name, i) => ({ name, i }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.i - b.i)
    .map((o) => o.name);
}

/**
 * Picked for you only when it's a safe guess: the game's only console, or
 * one you've used before. Otherwise nothing, so you choose.
 */
export function defaultConsole(ordered: string[], used: string[]): string {
  if (ordered.length === 1) return ordered[0];
  return ordered.find((name) => used.includes(name)) ?? '';
}

/**
 * Which console the game is on: a few likely chips, the rest behind "More",
 * and "Other" for anything IGDB doesn't list.
 */
export function ConsolePicker({
  ordered,
  value,
  onChange,
  autoFocus = false,
}: {
  /** From orderConsoles. */
  ordered: string[];
  value: string;
  onChange: (value: string) => void;
  /** Take focus when the dialog opens (the console is the first thing to decide). */
  autoFocus?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [typing, setTyping] = useState(ordered.length === 0);

  const listed = ordered.includes(value);
  const shown = showAll ? ordered : ordered.slice(0, VISIBLE);
  // A choice from behind "More" stays visible once it's picked.
  if (listed && !shown.includes(value)) shown.push(value);
  const hidden = ordered.length - shown.length;

  return (
    <div>
      <p className={FIELD_LABEL} id="console-label">
        Console
      </p>
      <div role="group" aria-labelledby="console-label" className="flex flex-wrap gap-1.5">
        {shown.map((name, i) => (
          <button
            key={name}
            type="button"
            data-autofocus={autoFocus && i === 0 ? true : undefined}
            aria-pressed={!typing && value === name}
            onClick={() => {
              setTyping(false);
              onChange(name);
            }}
            className={chipClass(!typing && value === name)}
          >
            {name}
          </button>
        ))}
        {hidden > 0 && (
          <button type="button" onClick={() => setShowAll(true)} className={chipClass(false)}>
            {hidden} more
          </button>
        )}
        {ordered.length > 0 && (
          <button
            type="button"
            aria-pressed={typing}
            onClick={() => {
              setTyping(true);
              if (listed) onChange('');
            }}
            className={chipClass(typing)}
          >
            Other
          </button>
        )}
      </div>
      {typing && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Switch 2"
          aria-label="Console"
          maxLength={60}
          autoFocus={ordered.length > 0}
          className={`${fieldClass()} mt-2 h-10 px-3 text-sm`}
        />
      )}
    </div>
  );
}
