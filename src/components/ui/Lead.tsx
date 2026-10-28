import type { ReactNode } from 'react';

/**
 * A sentence that leads a section and carries its numbers ("You've played for
 * 1,027 hours"), in place of a row of figures. `md` for dialogs.
 */
export function Lead({ children, size = 'lg' }: { children: ReactNode; size?: 'lg' | 'md' }) {
  return (
    <p
      className={`max-w-3xl font-semibold tracking-tight text-balance text-ink-300 ${
        size === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
      }`}
    >
      {children}
    </p>
  );
}

/** A figure in a sentence, standing out from the words around it. */
export function Figure({ children }: { children: ReactNode }) {
  return <span className="text-ink-50">{children}</span>;
}
