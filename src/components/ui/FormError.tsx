import type { ReactNode } from 'react';

/**
 * What went wrong with a form as a whole (the server refused it, the link
 * couldn't be sent), in a rose box above its fields and read out as it
 * appears. An error about one field goes under that field instead (`Input`'s
 * `error`).
 */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">
      {children}
    </div>
  );
}
