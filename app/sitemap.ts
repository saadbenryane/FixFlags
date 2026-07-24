import type { MetadataRoute } from 'next'
import { BLOG_POSTS, SITE_URL } from '@/lib/marketing/copy'
import { INDEXABLE_ROUTES, LLMS_TXT_PATH } from '@/lib/marketing/seo-routes'
import {
  getIndexableIssueCheckIds,
  getIndexableMadewithProfiles,
} from '@/lib/graph/queries'

const baseUrl = SITE_URL.replace(/\/$/, '')

// The issue inventory is backed by PostgreSQL and is only available at runtime.
// Keeping this route dynamic prevents image builds from querying production data.
export const dynamic = 'force-dynamic'

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
  const [issues, technologyProfiles] = await Promise.all([
    getIndexableIssueCheckIds(),
    getIndexableMadewithProfiles(),
  ])
  for (const issue of issues) {
    pages.push({
      url: `${baseUrl}/issues/${issue.checkId}`,
      lastModified: issue.lastSeenAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  }

  for (const profile of technologyProfiles) {
    pages.push({
      url: `${baseUrl}/madewith/${profile.hostname}`,
      lastModified: profile.lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
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
