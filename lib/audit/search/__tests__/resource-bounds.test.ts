import { beforeEach, describe, expect, it, vi } from 'vitest'
const fetchDocument = vi.hoisted(() => vi.fn())
vi.mock('../../url', async importOriginal => ({ ...await importOriginal<typeof import('../../url')>(), safeFetchDocument: fetchDocument }))
import { collectSiteResources, SITEMAP_URL_LIMIT, SITEMAP_DOCUMENT_LIMIT } from '../collect'
import { document, evidence, PAGE } from './fixtures'
import { collectionHandlers } from '../../progressive/collectors'
import { readArtifact, serializeArtifact } from '../../progressive/contracts'
import { resourceArtifactSchema } from '../../progressive/snapshots'
import type { TaskContext } from '../../progressive/registry'
import { evaluateSearch } from '../registry'

const handler = collectionHandlers.find(handler => handler.kind === 'search-resources')!
const pageSet = (start: number, count: number) => '<urlset>' + Array.from({ length: count }, (_, index) =>
  `<url><loc>https://example.com/p${start + index}</loc></url>`).join('') + '</urlset>'
const indexSet = (start: number, count: number) => '<sitemapindex>' + Array.from({ length: count }, (_, index) =>
  `<sitemap><loc>https://example.com/s${start + index}.xml</loc></sitemap>`).join('') + '</sitemapindex>'

beforeEach(() => fetchDocument.mockReset())
function serve(documents: Record<string, string>) {
  fetchDocument.mockImplementation(async (url: string) => ({ body: documents[url] ?? pageSet(0, 1),
    finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [] }))
}
async function taskResources(robots: string) {
  const context: TaskContext = { audit: { id: 'resource-bounds' } as TaskContext['audit'],
    task: { id: 'resources' } as TaskContext['task'],
    input: { pageUrl: PAGE, position: 0, primary: true, role: 'primary', module: 'sitemaps' },
    deadline: Date.now() + 10_000, dependencies: new Map([['robots', {
      workKind: 'search-resources', workState: 'COMPLETED', workResult: serializeArtifact('search-resources', {
        robots: document(robots), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [],
      }),
    } as TaskContext['task']]]) }
  const artifact = await handler.evaluate(context)
  handler.validateResult(artifact)
  return resourceArtifactSchema.parse(readArtifact(artifact, 'search-resources').data)
}

describe('aggregate sitemap evidence bounds', () => {
  it('retains valid documents and bounded page evidence when several sitemaps exceed the shared task limit', async () => {
    serve({ [PAGE + 'one.xml']: pageSet(0, 6000), [PAGE + 'two.xml']: pageSet(6000, 6000) })
    const resources = await taskResources(`Sitemap: ${PAGE}one.xml\nSitemap: ${PAGE}two.xml`)
    expect(resources.sitemapUrls).toHaveLength(SITEMAP_URL_LIMIT)
    expect(resources.sitemapUrls[0]).toBe(PAGE + 'p0')
    expect(resources.sitemapUrls.at(-1)).toBe(PAGE + 'p9999')
    expect(resources.sitemaps).toHaveLength(2)
    expect(resources.sitemaps.every(document => document.complete)).toBe(true)
    expect(resources.complete).toBe(false)
    expect(fetchDocument).toHaveBeenCalledTimes(2)
    const observations = await evaluateSearch(evidence('<title>Page</title>', { ...resources, sitemapsComplete: resources.complete }), null, ['discovery'])
    expect(observations.find(item => item.checkId === 'search-sitemap-coverage')).toMatchObject({ disposition: 'unknown' })
    expect(observations.filter(item => item.checkId === 'sitemap-missing').every(item => item.disposition === 'passed')).toBe(true)
  })

  it('deduplicates overlapping page inventories before consuming the shared bound', async () => {
    serve({ [PAGE + 'one.xml']: pageSet(0, 6000), [PAGE + 'two.xml']: pageSet(4000, 6000) })
    const resources = await taskResources(`Sitemap: ${PAGE}one.xml\nSitemap: ${PAGE}two.xml`)
    expect(resources.sitemapUrls).toHaveLength(SITEMAP_URL_LIMIT)
    expect(resources.complete).toBe(true)
  })

  it('bounds accumulated declarations from robots and child indexes without discarding collected documents', async () => {
    const robots = Array.from({ length: 6000 }, (_, index) => `Sitemap: ${PAGE}s${index}.xml`).join('\n')
    serve({ [PAGE + 's0.xml']: indexSet(6000, 6000) })
    const resources = await taskResources(robots)
    expect(resources.declaredSitemaps).toHaveLength(SITEMAP_URL_LIMIT)
    expect(resources.declaredSitemaps[0]).toBe(PAGE + 's0.xml')
    expect(resources.declaredSitemaps.at(-1)).toBe(PAGE + 's9999.xml')
    expect(resources.sitemaps).toHaveLength(SITEMAP_DOCUMENT_LIMIT)
    expect(resources.complete).toBe(false)
    expect(fetchDocument).toHaveBeenCalledTimes(SITEMAP_DOCUMENT_LIMIT)
  })

  it('bounds an oversized robots declaration list before publishing the resource artifact', async () => {
    serve({})
    const robots = Array.from({ length: SITEMAP_URL_LIMIT + 1 }, (_, index) => `Sitemap: ${PAGE}s${index}.xml`).join('\n')
    const resources = await taskResources(robots)
    expect(resources.declaredSitemaps).toHaveLength(SITEMAP_URL_LIMIT)
    expect(resources.complete).toBe(false)
    expect(fetchDocument).toHaveBeenCalledTimes(SITEMAP_DOCUMENT_LIMIT)
  })

  it('retains malformed XML as a failed observation alongside partial aggregate coverage', async () => {
    serve({ [PAGE + 'bad.xml']: '<urlset><url>' })
    const resources = await collectSiteResources(PAGE, Date.now() + 10_000, document(`Sitemap: ${PAGE}bad.xml`))
    const observations = await evaluateSearch(evidence('', { ...resources, sitemapsComplete: resources.complete }), null, ['discovery'])
    expect(observations.find(item => item.checkId === 'search-sitemap-invalid')).toMatchObject({ disposition: 'failed' })
    expect(resources.complete).toBe(false)
  })
})
