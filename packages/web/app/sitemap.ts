import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/pricing', '/login'];
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
