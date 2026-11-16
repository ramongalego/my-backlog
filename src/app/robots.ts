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
        // one is kept out as soon as it is protected.
        disallow: PROTECTED_ROUTES,
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
