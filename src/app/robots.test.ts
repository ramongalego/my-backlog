import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

it('keeps search engines out of every signed-in page, Profile included', () => {
  const [rule] = robots().rules as { allow: string; disallow: string[] }[];
  expect(rule.allow).toBe('/');
  expect(rule.disallow).toEqual(
    expect.arrayContaining(['/home', '/games', '/playing-queue', '/diary', '/stats', '/profile']),
  );
});

it('lists the public pages in the sitemap, and points robots at it', () => {
  const paths = sitemap().map((entry) => new URL(entry.url).pathname);
  expect(paths).toEqual(['/', '/privacy', '/terms']);
  expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
});
