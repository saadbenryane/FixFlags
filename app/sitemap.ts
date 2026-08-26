import type { MetadataRoute } from 'next'
import { BLOG_POSTS, SITE_URL } from '@/lib/marketing/copy'
import { INDEXABLE_ROUTES, LLMS_TXT_PATH } from '@/lib/marketing/seo-routes'
import { getIndexableIssueCheckIds } from '@/lib/graph/queries'
import { HELP_ARTICLES, HELP_CATEGORIES } from '@/lib/help/catalog'
import { helpArticlePath } from '@/lib/help/types'

const baseUrl = SITE_URL.replace(/\/$/, '')

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const pages: MetadataRoute.Sitemap = INDEXABLE_ROUTES.map((route) => ({
    url: route.path === '/' ? baseUrl : `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  for (const category of HELP_CATEGORIES) {
    pages.push({
      url: `${baseUrl}/help/${category.id}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  for (const article of HELP_ARTICLES) {
    pages.push({
      url: `${baseUrl}${helpArticlePath(article.categoryId, article.slug)}`,
      lastModified: article.updatedAt ? new Date(article.updatedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.55,
    })
  }

  for (const post of BLOG_POSTS) {
    pages.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

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
