import type { ReactNode } from 'react';
import { SECTION_HEADING } from './profile-layout';

/**
 * A section of the Profile page's main column: its title, with one quiet
 * action beside it (a link onwards, or a button), then its content.
 */
export function ProfileSection({
  id,
  title,
  action,
  children,
}: {
  /** For the heading's id, which names the section. */
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className={SECTION_HEADING}>
        <h2 id={id} className="text-lg sm:text-xl font-semibold tracking-tight text-ink-50">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
