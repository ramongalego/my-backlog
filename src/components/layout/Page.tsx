import type { ReactNode } from 'react';

// Shared page chrome so every signed-in page (and its loading skeleton) uses
// the same container, top offset under the fixed header, and header spacing.

export const PAGE_CONTAINER = 'max-w-7xl mx-auto px-4 sm:px-6';

/** Full-height page with the standard container. Modals can be passed as `overlay`. */
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

/**
 * Page title, optional one-line description, and optional actions that sit on
 * the right when there's room and wrap below the title when there isn't.
 * `children` renders as a toolbar row under the header (e.g. search + sort).
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-ink-50">
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

/** Heading for a group of content inside a page (stats cards, queue sections). */
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={`text-sm font-semibold text-ink-200 ${className}`}>{children}</h2>;
}
