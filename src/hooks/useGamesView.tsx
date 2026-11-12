'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { GAMES_VIEW_COOKIE, parseGamesView, type GamesView } from '@/lib/games/games-view';

const YEAR_S = 60 * 60 * 24 * 365;

// What the server read from the cookie when it rendered the page. The
// browser's first render uses the same, so the two agree; from then on the
// browser reads the cookie itself, which a change of view has just written.
const ServerView = createContext<GamesView>('grid');

/** Hands the view the server rendered with to the Games page and its skeleton. */
export function GamesViewProvider({ value, children }: { value: GamesView; children: ReactNode }) {
  return <ServerView.Provider value={value}>{children}</ServerView.Provider>;
}

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function readCookie(): GamesView {
  const entry = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${GAMES_VIEW_COOKIE}=`));
  return parseGamesView(entry?.slice(GAMES_VIEW_COOKIE.length + 1));
}

function writeCookie(view: GamesView) {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${GAMES_VIEW_COOKIE}=${view}; path=/; max-age=${YEAR_S}; samesite=lax${secure}`;
  for (const listener of listeners) listener();
}

/**
 * The Games page's layout, grid or list, and a way to change it. The choice is
 * remembered on this device (in a cookie) until it's changed again.
 */
export function useGamesView(): [GamesView, (view: GamesView) => void] {
  const fromServer = useContext(ServerView);
  const view = useSyncExternalStore(subscribe, readCookie, () => fromServer);
  return [view, writeCookie];
}
