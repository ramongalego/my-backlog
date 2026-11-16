import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    // The policies: public, and worth finding.
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
