import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison. Lengths are compared first (not a leak —
 * an attacker can already observe the token length from their own submission),
 * but the bodies are compared via timingSafeEqual to avoid short-circuit
 * timing leaks from a naïve `===`.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
