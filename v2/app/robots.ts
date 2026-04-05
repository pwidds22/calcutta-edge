import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auction', '/host/', '/live/', '/profile', '/payment', '/login', '/register'],
      },
    ],
    sitemap: 'https://calcuttaedge.com/sitemap.xml',
  }
}
