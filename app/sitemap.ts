import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/marketing/copy'
import { INDEXABLE_ROUTES, LLMS_TXT_PATH } from '@/lib/marketing/seo-routes'

const baseUrl = SITE_URL.replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const pages: MetadataRoute.Sitemap = INDEXABLE_ROUTES.map((route) => ({
    url: route.path === '/' ? baseUrl : `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  pages.push({
    url: `${baseUrl}${LLMS_TXT_PATH}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.4,
  })

  return pages
}
