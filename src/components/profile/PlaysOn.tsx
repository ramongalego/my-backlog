import Link from 'next/link';
import { Panel } from '@/components/ui/Panel';
import { SidePanelHeading } from './SidePanelHeading';

const ROW = 'flex items-center justify-between gap-3 px-2 py-1.5 text-sm text-ink-300';

/** Every platform the library is played on, most games first: none folded away. */
export function PlaysOn({
  platforms,
  linked = true,
}: {
  platforms: { name: string; count: number }[];
  /**
   * Each platform leads to the Games page listing it. Off on someone else's
   * profile: that page is the visitor's own library.
   */
  linked?: boolean;
}) {
  if (platforms.length === 0) return null;

  return (
    <Panel>
      {/* The rows have their own room above and below. */}
      <SidePanelHeading count={platforms.length} className="mb-1.5">
        Platforms
      </SidePanelHeading>
      <ul className="-mx-2">
        {platforms.map(({ name, count }) => {
          const row = (
            <>
              <span className="min-w-0 truncate">{name}</span>{' '}
              <span className="text-xs tabular-nums text-ink-500">
                {count}
                <span className="sr-only"> {count === 1 ? 'game' : 'games'}</span>
              </span>
            </>
          );
          return (
            <li key={name}>
              {linked ? (
                <Link
                  href={`/games?platform=${encodeURIComponent(name)}`}
                  className={`${ROW} rounded-lg transition-colors hover:bg-ink-800 hover:text-ink-50`}
                >
                  {row}
                </Link>
              ) : (
                <div className={ROW}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
