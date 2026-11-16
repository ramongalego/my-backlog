'use client';

import { useSyncExternalStore } from 'react';
import { connectSteam } from '@/lib/client/steam-connect';

// Connecting Steam leaves for Steam's sign-in page, which takes a second or
// two to arrive: this server asks Steam for the address first. Until then the
// page is still here, so whatever was pressed has to show it was.
//
// Kept outside React, once for the whole page: every Connect Steam control
// (the header's menu, a page's own button) is busy together, and a second
// press on any of them starts nothing.

/** If Steam's page still hasn't come: the controls can be pressed again. */
const GIVE_UP_MS = 20_000;

let connecting = false;
let giveUp: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(value: boolean) {
  clearTimeout(giveUp);
  if (connecting === value) return;
  connecting = value;
  listeners.forEach((listener) => listener());
}

// Back from Steam's page with the browser's Back button, the page is shown
// again as it was left, still saying it's connecting: it isn't any more.
const shownAgain = (event: PageTransitionEvent) => {
  if (event.persisted) set(false);
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function connect() {
  // Also what makes it once per press: `connecting` is set before any redraw.
  if (connecting) return;
  // Listened for from the first press on, whatever is on screen by then
  // (adding the same listener again does nothing).
  window.addEventListener('pageshow', shownAgain);
  set(true);
  giveUp = setTimeout(() => set(false), GIVE_UP_MS);
  connectSteam();
}

/**
 * Starting to connect Steam, and whether it's been started: `connect` for a
 * control's press, `connecting` for it to show as busy until Steam's page
 * takes over (see ConnectSteamButton for the usual button).
 */
export function useConnectSteam() {
  const isConnecting = useSyncExternalStore(
    subscribe,
    () => connecting,
    () => false,
  );
  return { connecting: isConnecting, connect };
}
