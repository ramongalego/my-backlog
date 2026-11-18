'use client';

import { useEffect, useRef } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';

/** The menu's value for every platform (the URL has no `platform` for it). */
const ALL = '';

interface GamesPlatformProps {
  /**
   * The filter's state, or null when there's nothing to choose between (see
   * useGamesPage): then nothing is drawn.
   */
  platforms: {
    /** The platform listed, or '' for all of them. */
    value: string;
    set: (platform: string) => void;
    /** The platforms to offer, with how many games each would list. */
    options: { value: string; count: number }[];
    /** How many games all of them together list. */
    allCount: number;
  } | null;
  /**
   * The menu went away while it had the keyboard's focus (choosing "All
   * platforms" under a status filter with one platform takes it off the
   * page): the page moves focus to the control after it.
   */
  onGone: () => void;
}

/**
 * Which platform's games the Games page lists, beside the search it narrows
 * with: a menu on the toolbar's surface, like Sort. While it's narrowing the
 * page it's lit like a chosen chip and names the platform, so a filter left on
 * can't pass for a library with games missing. Below `md`, where the toolbar
 * is tight, it's the icon alone (as Select is on phones): its width never
 * changes with the choice, so the row beside it doesn't move, and the page's
 * heading says which platform is listed.
 */
export function GamesPlatform({ platforms, onGone }: GamesPlatformProps) {
  const shown = platforms !== null;
  const wasShown = useRef(shown);
  useEffect(() => {
    // Focus that was on a control taken off the page is left on nothing.
    const focusLost = !document.activeElement || document.activeElement === document.body;
    if (wasShown.current && !shown && focusLost) onGone();
    wasShown.current = shown;
  }, [shown, onGone]);

  if (!platforms) return null;
  const filtering = platforms.value !== ALL;
  return (
    <Dropdown
      value={platforms.value}
      options={[
        { value: ALL, label: 'All platforms', count: platforms.allCount },
        ...platforms.options.map((option) => ({ ...option, label: option.value })),
      ]}
      onChange={platforms.set}
      // At the end of the search's row on phones; after the search from `sm`.
      align="responsive-left"
      aria-label="Platform"
      icon={<MonitorSmartphone className="h-4 w-4" />}
      triggerClassName={`shrink-0 rounded-lg px-3 ${
        filtering ? 'bg-ink-100' : 'bg-ink-800 hover:bg-ink-700'
      }`}
      triggerTone={filtering ? 'text-ink-950' : undefined}
      // A console named by hand can be long: it's cut short here, whole in the menu.
      labelClassName="sr-only md:not-sr-only md:block md:max-w-28 md:truncate lg:max-w-40"
    />
  );
}
