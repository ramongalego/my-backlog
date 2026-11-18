'use client';

import { useSyncExternalStore } from 'react';
import { connectSteam } from '@/lib/client/steam-connect';

// Steam's sign-in page takes a second or two to arrive, so whatever was pressed
// has to show it was. Kept outside React so every Connect Steam control is busy
// together, and a second press on any of them starts nothing.

/** After this, if Steam's page still hasn't come, the controls can be pressed again. */
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

// Back from Steam with the Back button, the page is restored as it was left,
// still saying it's connecting.
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
  // On press, whatever is on screen by then; adding it again does nothing.
  window.addEventListener('pageshow', shownAgain);
  set(true);
  giveUp = setTimeout(() => set(false), GIVE_UP_MS);
  connectSteam();
}

/** `connecting` shows a control as busy until Steam's page takes over (see ConnectSteamButton). */
export function useConnectSteam() {
  const isConnecting = useSyncExternalStore(
    subscribe,
    () => connecting,
    () => false,
  );
  return { connecting: isConnecting, connect };
}
