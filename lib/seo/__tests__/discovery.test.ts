import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { dynamic, GET } from '@/app/llms.txt/route'
import nextConfig from '@/next.config'
import { getIndexableIssueCheckIds } from '@/lib/graph/queries'
import { BLOG_POSTS, BRAND, SITE_URL } from '@/lib/marketing/copy'
import { buildLlmsTxt } from '@/lib/marketing/llms-txt'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'
import { marketingGraphSchema } from '@/lib/marketing/structured-data'
import { HELP_ARTICLES, HELP_CATEGORIES } from '@/lib/help/catalog'
import { helpArticlePath } from '@/lib/help/types'

vi.mock('@/lib/graph/queries', () => ({ getIndexableIssueCheckIds: vi.fn() }))

const baseUrl = SITE_URL.replace(/\/$/, '')
const issue = {
  checkId: 'missing-alt-text',
  siteCount: 20,
  lastSeenAt: new Date('2026-10-01T12:00:00Z'),
}

describe('technical discovery', () => {
  beforeEach(() => {
    vi.mocked(getIndexableIssueCheckIds).mockResolvedValue([issue])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('allows public search discovery and excludes tenant and account flows for every crawler group', () => {
    const policy = robots()
    const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules]
    const agents = rules.flatMap((rule) => rule.userAgent)
    expect(agents).toEqual(expect.arrayContaining([
      '*', 'OAI-SearchBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
    ]))
    for (const rule of rules) {
      expect(rule.allow).toBe('/')
      expect(rule.disallow).toEqual(expect.arrayContaining([
        '/api', '/admin', '/dashboard', '/sites', '/products', '/settings',
        '/sign-in', '/two-factor', '/cli', '/onboarding', '/shopify', '/integrations/connect',
      ]))
      for (const route of INDEXABLE_ROUTES) {
        expect((rule.disallow as string[]).some((prefix) => route.path.startsWith(prefix)), route.path).toBe(false)
      }
    }
    expect(policy.sitemap).toBe(`${baseUrl}/sitemap.xml`)
  })

  it('describes the shipped product and links to published content in llms.txt', () => {
    const text = buildLlmsTxt()
    expect(text.startsWith(`# ${BRAND.name}\n\n> ${BRAND.oneLiner}\n`)).toBe(true)
    for (const section of LLMS_SECTIONS) {
      for (const link of section.links) {
        expect(text).toContain(`](${baseUrl}${link.path})`)
      }
    }
    expect(text).toContain(`](${baseUrl}/blog)`)
    expect(text).toContain(`](${baseUrl}/changelog)`)
    for (const post of BLOG_POSTS) {
      expect(text).toContain(`[${post.title}](${baseUrl}/blog/${post.slug}): ${post.excerpt}`)
    }
  })

  it('keeps the AI discovery index limited to canonical public destinations', () => {
    const publicPaths = new Set([
      ...INDEXABLE_ROUTES.map((route) => route.path),
      ...HELP_CATEGORIES.map((category) => `/help/${category.id}`),
      ...HELP_ARTICLES.map((article) => helpArticlePath(article.categoryId, article.slug)),
      ...BLOG_POSTS.map((post) => `/blog/${post.slug}`),
    ])
    const links = [...buildLlmsTxt().matchAll(/\]\(([^)]+)\)/g)]
    expect(links.length).toBeGreaterThan(0)
    for (const [, href] of links) {
      const url = new URL(href)
      expect(url.origin).toBe(new URL(baseUrl).origin)
      expect(publicPaths.has(url.pathname), href).toBe(true)
      expect(url.search).toBe('')
    }
  })

  it('serves a cacheable, plain-text AI discovery index', async () => {
    const response = await GET()
    expect(dynamic).toBe('force-static')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(await response.text()).toBe(buildLlmsTxt())
  })

  it('lists canonical marketing, help, blog, and eligible issue URLs without duplicates', async () => {
    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)
    expect(new Set(urls).size).toBe(urls.length)
    for (const route of INDEXABLE_ROUTES) {
      expect(urls).toContain(route.path === '/' ? baseUrl : `${baseUrl}${route.path}`)
    }
    for (const article of HELP_ARTICLES) {
      expect(urls).toContain(`${baseUrl}${helpArticlePath(article.categoryId, article.slug)}`)
    }
    for (const post of BLOG_POSTS) {
      expect(entries.find((entry) => entry.url.endsWith(`/blog/${post.slug}`))?.lastModified)
        .toEqual(new Date(post.updatedAt ?? post.publishedAt ?? post.date))
    }
    expect(entries.find((entry) => entry.url.endsWith(`/issues/${issue.checkId}`))?.lastModified)
      .toEqual(issue.lastSeenAt)
  })

  it('does not advertise a new content update when only the request time changes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T00:00:00Z'))
    const first = await sitemap()
    vi.setSystemTime(new Date('2026-10-12T00:00:00Z'))
    expect(await sitemap()).toEqual(first)
    expect(first.find((entry) => entry.url === baseUrl)?.lastModified).toBeUndefined()
  })

  it('still publishes the public sitemap when optional issue discovery is unavailable', async () => {
    vi.mocked(getIndexableIssueCheckIds).mockRejectedValue(new Error('Database unavailable'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const entries = await sitemap()
    expect(entries.some((entry) => entry.url === baseUrl)).toBe(true)
    expect(entries.some((entry) => entry.url.endsWith('/pricing'))).toBe(true)
    expect(entries.some((entry) => entry.url.includes('/issues/'))).toBe(false)
    expect(warning).toHaveBeenCalled()
  })

  it('publishes a connected organization, website, and software graph with a resolvable logo', async () => {
    const graph = marketingGraphSchema()
    expect(graph['@context']).toBe('https://schema.org')
    const organization = graph['@graph'].find((node) => node['@type'] === 'Organization')!
    expect(graph['@graph']).toEqual(expect.arrayContaining([
      expect.objectContaining({ '@type': 'WebSite', publisher: { '@id': organization['@id'] } }),
      expect.objectContaining({ '@type': 'SoftwareApplication', url: SITE_URL }),
    ]))
    expect('logo' in organization).toBe(true)
    const logoPath = new URL((organization as { logo: string }).logo).pathname
    const redirects = await nextConfig.redirects!()
    const redirect = redirects.find((rule) => rule.source === logoPath)
    expect(redirect).toMatchObject({ destination: '/icon-512.png', permanent: true })
    expect(existsSync(resolve('public', redirect!.destination.slice(1)))).toBe(true)
  })
})
