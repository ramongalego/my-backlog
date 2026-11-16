/**
 * @jest-environment node
 */
import { GET } from './route';

it('says where to report a vulnerability, as plain text', async () => {
  const res = GET();
  expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  const text = await res.text();
  expect(text).toContain('Contact: mailto:contact@mybacklog.co\n');
  expect(text).toMatch(/^Canonical: https:\/\/.+\/\.well-known\/security\.txt$/m);
});

it('is good for about six months from when it is asked for, so it never goes stale', async () => {
  const expires = /^Expires: (.+)$/m.exec(await GET().text())![1];
  const days = (new Date(expires).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  // The standard asks for less than a year.
  expect(days).toBeGreaterThan(170);
  expect(days).toBeLessThan(190);
});
