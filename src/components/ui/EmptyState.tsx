import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Shown when a list or page has nothing to show. The description should
 * teach: say what will appear here and how it gets there.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <Icon className="w-8 h-8 text-ink-600 mb-4" aria-hidden="true" />
      <p className="text-ink-200 font-medium">{title}</p>
      {children && <p className="text-ink-400 text-sm mt-1 max-w-sm">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
