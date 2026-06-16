import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/marketing/copy'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL

  const staticPages = [
    { url: baseUrl, priority: 1.0, changeFrequency: 'weekly' as const },
    { url: `${baseUrl}/pricing`, priority: 0.9, changeFrequency: 'monthly' as const },
    { url: `${baseUrl}/faq`, priority: 0.7, changeFrequency: 'monthly' as const },
    { url: `${baseUrl}/examples`, priority: 0.6, changeFrequency: 'weekly' as const },
    { url: `${baseUrl}/samples`, priority: 0.7, changeFrequency: 'weekly' as const },
    { url: `${baseUrl}/docs/mcp`, priority: 0.5, changeFrequency: 'monthly' as const },
    { url: `${baseUrl}/privacy`, priority: 0.3, changeFrequency: 'yearly' as const },
    { url: `${baseUrl}/terms`, priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  return staticPages
}
