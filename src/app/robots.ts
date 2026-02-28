import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/home', '/games', '/diary', '/stats', '/playing-queue'],
      },
    ],
    sitemap: 'https://mybacklog.app/sitemap.xml',
  };
}
