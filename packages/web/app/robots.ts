import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep the app surface and admin tooling out of the index.
      disallow: ['/chat', '/study', '/practice', '/dashboard', '/paywall', '/admin', '/login'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
