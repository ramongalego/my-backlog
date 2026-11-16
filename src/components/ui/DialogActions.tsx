import type { ReactNode } from 'react';

/**
 * The row of buttons a dialog ends on: Cancel (the secondary button) and the
 * action, at the usual button height, sharing the dialog's width. Every
 * dialog ends the same way, the game dialog included. On the narrowest
 * phones Cancel takes only its own width, so the action's label stays on one
 * line.
 */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 pt-1 *:flex-1 *:whitespace-nowrap max-[359px]:*:first:flex-none">
      {children}
    </div>
  );
}
