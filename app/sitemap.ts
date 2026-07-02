import type { MetadataRoute } from 'next'
import { BLOG_POSTS, SITE_URL } from '@/lib/marketing/copy'
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

  for (const post of BLOG_POSTS) {
    pages.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  pages.push({
    url: `${baseUrl}${LLMS_TXT_PATH}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.4,
  })

  return pages
}
