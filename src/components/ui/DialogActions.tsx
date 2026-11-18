import type { ReactNode } from 'react';

/**
 * Every dialog ends on this row: Cancel and the action, sharing the dialog's width.
 * Below 360px Cancel takes only its own width, so the action's label stays on one line.
 */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 pt-1 *:flex-1 *:whitespace-nowrap max-[359px]:*:first:flex-none">
      {children}
    </div>
  );
}
