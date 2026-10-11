import type { MetadataRoute } from 'next'
import { BLOG_POSTS, SITE_URL } from '@/lib/marketing/copy'
import { INDEXABLE_ROUTES, LLMS_TXT_PATH } from '@/lib/marketing/seo-routes'
import { getIndexableIssueCheckIds } from '@/lib/graph/queries'
import { HELP_ARTICLES, HELP_CATEGORIES } from '@/lib/help/catalog'
import { helpArticlePath } from '@/lib/help/types'

const baseUrl = SITE_URL.replace(/\/$/, '')

export const dynamic = 'force-dynamic'

function blogLastModified(post: { date: string; updatedAt?: string; publishedAt?: string }): Date {
  return new Date(post.updatedAt ?? post.publishedAt ?? post.date)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = INDEXABLE_ROUTES.map((route) => ({
    url: route.path === '/' ? baseUrl : `${baseUrl}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  for (const category of HELP_CATEGORIES) {
    pages.push({
      url: `${baseUrl}/help/${category.id}`,
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  for (const article of HELP_ARTICLES) {
    pages.push({
      url: `${baseUrl}${helpArticlePath(article.categoryId, article.slug)}`,
      ...(article.updatedAt ? { lastModified: new Date(article.updatedAt) } : {}),
      changeFrequency: 'monthly',
      priority: 0.55,
    })
  }

  for (const post of BLOG_POSTS) {
    pages.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: blogLastModified(post),
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  const issues = await getIndexableIssueCheckIds().catch(() => {
    console.warn('[sitemap] Issue discovery unavailable; serving public content only')
    return []
  })
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
    changeFrequency: 'monthly',
    priority: 0.4,
  })

  return pages
}
