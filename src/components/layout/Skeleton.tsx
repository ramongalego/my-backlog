import type { ReactNode } from 'react';
import { PANEL_SURFACE } from '@/components/ui/Panel';
import { PAGE_CONTAINER } from './Page';

// Building blocks for loading skeletons. Each page's skeleton is assembled
// from the same container and header dimensions as the real page, so nothing
// shifts when the content arrives.

/** A single shimmering placeholder block. Size it with width/height classes. */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`bg-ink-800 rounded animate-pulse ${className}`}
    />
  );
}

/** Same outer layout as <Page>, announced to assistive tech as loading. */
export function PageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className={`pt-20 sm:pt-24 pb-16 ${PAGE_CONTAINER}`}>{children}</div>
    </div>
  );
}

/** Mirrors <PageHeader>: a 32px title line and a 20px description line. */
export function PageHeaderSkeleton({
  titleWidth = 'w-40',
  descriptionWidth = 'w-56',
  actions,
  children,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className={`h-8 sm:h-9 ${titleWidth}`} />
          <Skeleton className={`h-4 mt-2 ${descriptionWidth}`} />
        </div>
        {actions && <div className="max-w-full">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** A placeholder with the same surface as <Panel>; pass the padding you'd give the real one. */
export function PanelSkeleton({
  className = '',
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={`${PANEL_SURFACE} ${className}`}>{children}</div>;
}
