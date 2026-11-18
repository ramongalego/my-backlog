import 'server-only';
import { timingSafeEqual } from 'crypto';

/**
 * Comparing lengths first leaks nothing: an attacker already knows the length
 * of the token they sent. `===` would leak where the bodies differ.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
