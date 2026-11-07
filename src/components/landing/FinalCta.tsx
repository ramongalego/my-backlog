import type { AuthMode } from '@/types/auth';
import { GetStartedButton } from './GetStartedButton';

/** The closing call to sign up. */
export function FinalCta({ onOpen }: { onOpen: (mode: AuthMode) => void }) {
  return (
    <section className="border-t border-ink-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-ink-50 leading-tight">
            Start clearing your backlog tonight
          </h2>
          <p className="mt-3 text-ink-400">
            It&apos;s free. Connect Steam to import your whole library, or add games from any
            console
          </p>
        </div>
        <div className="shrink-0">
          <GetStartedButton onClick={() => onOpen('signup')} />
        </div>
      </div>
    </section>
  );
}
