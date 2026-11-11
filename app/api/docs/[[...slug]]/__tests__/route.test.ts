import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRewrittenUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import { GET } from '@/app/api/docs/[[...slug]]/route'
import { GET as getFullDocs } from '@/app/llms-full.txt/route'
import { buildDocsMetadata, DOCS_PAGES } from '@/lib/docs/catalog'
import * as content from '@/lib/docs/content'
import { docsMarkdownPath } from '@/lib/docs/markdown-path'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'
import { SITE_URL } from '@/lib/marketing/copy/brand'
import nextConfig from '@/next.config'

vi.mock('server-only', () => ({}))

const baseUrl = SITE_URL.replace(/\/$/, '')
const request = new Request(`${baseUrl}/api/docs`)

afterEach(() => vi.restoreAllMocks())

describe('public Markdown documentation', () => {
  it.each(DOCS_PAGES)('serves $path from the published source, with canonical metadata', async page => {
    const slug = page.path.split('/').slice(2)
    const response = await GET(request, { params: Promise.resolve({ slug }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, follow')
    expect(response.headers.get('link')).toBe(`<${baseUrl}${page.path}>; rel="canonical"`)
    const body = await response.text()
    expect(body).toContain(`# ${page.title}\n`)
    expect(body).toContain(`Canonical page: ${baseUrl}${page.path}`)
    expect(body).not.toContain('<!-- generated:')
    expect(body).not.toMatch(/\]\(\//)
    expect(buildDocsMetadata(page).alternates).toMatchObject({
      canonical: `${baseUrl}${page.path}`,
      types: { 'text/markdown': docsMarkdownPath(page.path) },
    })
  })

  it.each(DOCS_PAGES)('rewrites the public Markdown address for $path', async page => {
    const response = await unstable_getResponseFromNextConfig({
      url: `${baseUrl}${docsMarkdownPath(page.path)}`, nextConfig,
    })
    const slug = page.path.slice('/docs'.length)
    expect(getRewrittenUrl(response)).toBe(`${baseUrl}/api/docs${slug}`)
  })

  it.each([
    ['not-published'], ['..', '..', 'SECURITY.md'], ['mcp.md'],
    ['integrations', 'not-published'], ['mcp', 'tools'], ['mcp/../../settings'],
  ])('rejects an address outside the published catalog: %j', async (...slug) => {
    const response = await GET(request, { params: Promise.resolve({ slug }) })
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Documentation not found.\n')
  })

  it('serves the docs home when no slug is supplied', async () => {
    const response = await GET(request, { params: Promise.resolve({}) })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('# FixFlags documentation')
  })

  it('includes all published docs and the current MCP tools in the full text', async () => {
    const response = await getFullDocs()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.text()
    for (const page of DOCS_PAGES) expect(body).toContain(`Canonical page: ${baseUrl}${page.path}\n`)
    for (const tool of MCP_TOOL_DEFINITIONS) expect(body).toContain(`\`${tool.name}\``)
    expect(body).toContain(`${baseUrl}/api/mcp`)
    expect(body).toContain('Authorization: Bearer <credential>')
    expect(body).not.toContain('<!-- generated:')
  })

  it('returns a sanitized unavailable response when a published source cannot be read', async () => {
    vi.spyOn(content, 'readDocsMarkdown').mockRejectedValue(new Error('private filesystem detail'))
    for (const response of [
      await GET(request, { params: Promise.resolve({ slug: ['mcp'] }) }),
      await getFullDocs(),
    ]) {
      expect(response.status).toBe(503)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.text()).toBe('Documentation is temporarily unavailable.\n')
    }
  })
})
