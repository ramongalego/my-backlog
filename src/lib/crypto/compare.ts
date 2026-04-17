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

/**
 * Verify an `Authorization: Bearer <secret>` header against an expected secret.
 * Returns true on match, false otherwise. Missing/malformed headers fail closed.
 */
export function verifyBearerToken(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader) return false;
  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return false;
  const provided = authHeader.slice(prefix.length);
  if (provided.length === 0) return false;
  return constantTimeCompare(provided, expectedSecret);
}
