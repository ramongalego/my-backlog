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
        {/* Takes focus when what had it in the section is gone (tabIndex -1). */}
        <h2
          id={id}
          tabIndex={-1}
          className="text-lg sm:text-xl font-semibold tracking-tight text-ink-50 outline-none"
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
