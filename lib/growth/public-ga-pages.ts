import { BLOG_POSTS } from '@/lib/marketing/copy/blog'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'

/** Use finite public labels for exported paths, including public acquisition steps. */
const paths = new Set([
  ...INDEXABLE_ROUTES.map(route => route.path),
  ...LLMS_SECTIONS.flatMap(section => section.links.map(link => link.path)),
  ...BLOG_POSTS.map(post => `/blog/${post.slug}`),
  '/new', '/sign-in', '/sign-up', '/post-login', '/two-factor',
])

export const FIXFLAGS_PUBLIC_GA_PAGES = [...paths]

export function publicGaPageRows(rows: Array<Record<string, string | number>>) {
  return rows.flatMap(({ pagePath, screenPageViews }) =>
    typeof pagePath === 'string' && paths.has(pagePath) &&
    typeof screenPageViews === 'number' && Number.isSafeInteger(screenPageViews) && screenPageViews >= 0
      ? [{ pagePath, screenPageViews }]
      : [],
  )
}
