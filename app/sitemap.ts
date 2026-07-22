import type { MetadataRoute } from 'next'
import { BLOG_POSTS, SITE_URL } from '@/lib/marketing/copy'
import { INDEXABLE_ROUTES, LLMS_TXT_PATH } from '@/lib/marketing/seo-routes'
import { getIndexableIssueCheckIds } from '@/lib/graph/queries'

const baseUrl = SITE_URL.replace(/\/$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // Dynamic issue pages from the knowledge graph.
  const issues = await getIndexableIssueCheckIds()
  for (const issue of issues) {
    pages.push({
      url: `${baseUrl}/issues/${issue.checkId}`,
      lastModified: issue.lastSeenAt,
      changeFrequency: 'weekly',
      priority: 0.7,
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
