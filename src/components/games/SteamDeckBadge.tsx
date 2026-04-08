import { Info } from 'lucide-react';

const DECK_COMPAT = {
  1: { label: 'Steam Deck Unsupported', color: 'text-rose-500' },
  2: { label: 'Steam Deck Playable', color: 'text-amber-400' },
  3: { label: 'Steam Deck Verified', color: 'text-emerald-400' },
} as const;

interface SteamDeckBadgeProps {
  deckCompat: number | null | undefined;
}

export function SteamDeckBadge({ deckCompat }: SteamDeckBadgeProps) {
  if (!deckCompat) return null;
  const config = DECK_COMPAT[deckCompat as keyof typeof DECK_COMPAT];
  if (!config) return null;

  return (
    <span className="relative group/deck hidden sm:inline-flex items-center">
      <Info className="w-3 h-3" />
      <span className="invisible group-hover/deck:visible pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 text-xs rounded whitespace-nowrap z-20">
        <span className={config.color}>{config.label}</span>
      </span>
    </span>
  );
}
