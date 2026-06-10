import type { MetadataRoute } from 'next'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/pricing', '/samples', '/docs/mcp', '/sign-in', '/sign-up'].map((path) => ({
    url: `${appUrl}${path}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }))
}
