import { CONTACT_EMAIL } from '@/lib/contact';
import { getBaseUrl } from '@/lib/url';

// Asked for fresh each time: the date below is counted from now.
export const dynamic = 'force-dynamic';

/** How far ahead the file says it's good for. The standard asks for under a year. */
const VALID_FOR_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * security.txt (RFC 9116), at the address security researchers look for it:
 * where to report a vulnerability. Contact and Expires are the two lines the
 * standard requires. Expires is worked out when the file is asked for, so it
 * never goes stale the way a file written once would.
 */
export function GET() {
  const lines = [
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${new Date(Date.now() + VALID_FOR_MS).toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${getBaseUrl()}/.well-known/security.txt`,
  ];
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
