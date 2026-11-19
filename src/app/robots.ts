import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/url';
import { PROTECTED_ROUTES } from '@/lib/routes';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The signed-in pages: nothing there for a search engine, and a new
        // one is kept out as soon as it is protected. Players' profiles (/u/)
        // are not listed here on purpose: they say `noindex` themselves, which a
        // crawler only sees if it is allowed to read the page.
        disallow: PROTECTED_ROUTES,
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
