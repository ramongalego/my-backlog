import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/home', '/games', '/diary', '/stats', '/playing-queue'],
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
