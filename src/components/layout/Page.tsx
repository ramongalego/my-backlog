import type { ReactNode } from 'react';

// Every signed-in page and its skeleton share this container, the offset under
// the fixed header, and the header spacing.

export const PAGE_CONTAINER = 'max-w-7xl mx-auto px-4 sm:px-6';

/** Modals go in `overlay`, outside <main>. */
export function Page({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950">
      <main id="main-content" className={`pt-20 sm:pt-24 pb-16 ${PAGE_CONTAINER}`}>
        {children}
      </main>
      {overlay}
    </div>
  );
}

/** `children` renders as a toolbar row under the header (search and sort, say). */
export function PageHeader({
  title,
  id,
  description,
  actions,
  children,
}: {
  title: string;
  /** Lets the title take focus from script, for when what had focus is gone. */
  id?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            id={id}
            tabIndex={id ? -1 : undefined}
            className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-ink-50 outline-none"
          >
            {title}
          </h1>
          {/* Rendered (empty) while a description is still loading, so the header keeps its height. */}
          {description !== undefined && (
            <div className="text-sm text-ink-400 mt-1 min-h-5">{description}</div>
          )}
        </div>
        {actions && <div className="max-w-full">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function SectionLabel({
  children,
  id,
  className = '',
}: {
  children: ReactNode;
  /** Lets the heading take focus from script, for when what had focus is gone. */
  id?: string;
  className?: string;
}) {
  return (
    <h2
      id={id}
      tabIndex={id ? -1 : undefined}
      className={`text-sm font-semibold text-ink-200 outline-none ${className}`}
    >
      {children}
    </h2>
  );
}
