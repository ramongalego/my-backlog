import 'server-only';

/**
 * Keeps what `read` answered for a key and hands it back for `ms`, then reads
 * again: never anything older. For reads anyone can ask for, so a page being
 * hammered costs one read per key in that time. (Not Next's `unstable_cache`:
 * past its time it still answers with what it has, however old, and reads
 * again behind that.)
 *
 * Held in this server's memory, so each running copy of the app keeps its own.
 * A read that fails isn't kept. The oldest keys go once there are `max`.
 */
export function reuse<T>(
  read: (key: string) => Promise<T>,
  { ms, max }: { ms: number; max: number },
): (key: string) => Promise<T> {
  const kept = new Map<string, { at: number; value: Promise<T> }>();
  return (key) => {
    const now = Date.now();
    const had = kept.get(key);
    if (had && now - had.at < ms) return had.value;

    const value = read(key);
    // Again at the end: the map's order is how old each one is.
    kept.delete(key);
    kept.set(key, { at: now, value });
    value.catch(() => {
      if (kept.get(key)?.value === value) kept.delete(key);
    });
    for (const oldest of kept.keys()) {
      if (kept.size <= max) break;
      kept.delete(oldest);
    }
    return value;
  };
}
