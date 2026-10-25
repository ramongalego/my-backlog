import { Ban, CircleAlert, CircleCheck } from 'lucide-react';
import { Tooltip, TooltipText } from '@/components/ui/Tooltip';

// Valve's compatibility ratings. The icon's shape carries the status, so the
// meta row stays neutral grey like its neighbours; the tooltip has the detail.
const DECK_COMPAT = {
  1: { label: 'Unsupported', detail: "Doesn't currently work on Steam Deck.", icon: Ban },
  2: {
    label: 'Playable',
    detail: 'Works on Steam Deck, but may need some tweaking to play.',
    icon: CircleAlert,
  },
  3: { label: 'Verified', detail: 'Works great on Steam Deck.', icon: CircleCheck },
} as const;

interface SteamDeckBadgeProps {
  deckCompat: number | null | undefined;
}

export function SteamDeckBadge({ deckCompat }: SteamDeckBadgeProps) {
  if (!deckCompat) return null;
  const config = DECK_COMPAT[deckCompat as keyof typeof DECK_COMPAT];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <Tooltip content={<TooltipText title={`Steam Deck ${config.label}`} detail={config.detail} />}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>Deck</span>
      <span className="sr-only"> {config.label}</span>
    </Tooltip>
  );
}
