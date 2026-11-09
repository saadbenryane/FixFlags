import { beforeEach, describe, expect, it, vi } from 'vitest'
const fetchDocument = vi.hoisted(() => vi.fn())
vi.mock('../../url', async importOriginal => ({ ...await importOriginal<typeof import('../../url')>(), safeFetchDocument: fetchDocument }))
import { collectSiteResources, qualifyRecordedSiteResources, SITEMAP_URL_LIMIT, SITEMAP_DOCUMENT_LIMIT } from '../collect'
import { document, evidence, PAGE } from './fixtures'
import { collectionHandlers } from '../../progressive/collectors'
import { readArtifact, serializeArtifact } from '../../progressive/contracts'
import { resourceArtifactSchema } from '../../progressive/snapshots'
import type { TaskContext } from '../../progressive/registry'
import { evaluateSearch, searchFindings } from '../registry'

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
  it('replays retained raw documents without borrowing membership from an old extension-only path', async () => {
    const index = PAGE + 'sitemap.xml', valid = PAGE + 'valid.xml', extension = PAGE + 'extension.xml'
    const raw = (url: string, body: string) => document(body, { url, finalUrl: url })
    const retained = resourceArtifactSchema.parse({ robots: document(`Sitemap: ${index}`), complete: true,
      sitemapUrls: [PAGE, PAGE + 'p0'], declaredSitemaps: [index, valid, extension], sitemaps: [
        raw(index, '<sitemapindex xmlns:x="urn:extension"><x:sitemap><x:loc>' + extension + '</x:loc></x:sitemap>' +
          '<sitemap><loc>' + valid + '</loc></sitemap></sitemapindex>'),
        raw(valid, pageSet(0, 1)), raw(extension, `<urlset><url><loc>${PAGE}</loc></url></urlset>`),
      ] })
    const qualified = await qualifyRecordedSiteResources(PAGE, retained)
    expect(qualified).toMatchObject({ sitemapStructureVersion: 2, complete: true, sitemapUrls: [PAGE + 'p0'], declaredSitemaps: [index, valid] })
    expect(qualified.sitemaps.map(document => document.url)).toEqual([index, valid])
    expect(fetchDocument).not.toHaveBeenCalled()
    const observations = await evaluateSearch(evidence('<meta name="robots" content="noindex">', { ...qualified, sitemapsComplete: qualified.complete }), null, ['indexing'])
    expect(observations.find(item => item.checkId === 'robots-blocks-indexing')).toMatchObject({ disposition: 'observed', reason: 'declared_indexing_exclusion' })
  })

  it('reinterprets a retained version-one text sitemap without opening another network request', async () => {
    const sitemap = PAGE + 'sitemap.txt'
    const retained = resourceArtifactSchema.parse({ robots: document(`Sitemap: ${sitemap}`), sitemapStructureVersion: 1,
      sitemapUrls: [], declaredSitemaps: [sitemap], complete: false, sitemaps: [document(PAGE + 'pricing\r\n', {
        url: sitemap, finalUrl: sitemap, headers: { 'content-type': 'text/plain' },
      })] })
    expect(await qualifyRecordedSiteResources(PAGE, retained)).toMatchObject({
      sitemapStructureVersion: 2, sitemapUrls: [PAGE + 'pricing'], complete: true,
    })
    expect(fetchDocument).not.toHaveBeenCalled()
  })
  it('starts known sibling files together while preserving traversal order and the five-file limit', async () => {
    const roots = ['first.xml', 'second.xml', 'third.xml'].map(path => PAGE + path)
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    fetchDocument.mockImplementation(async (url: string) => {
      if (url === roots[0]) await held
      return { body: url === roots[0] ? indexSet(0, 2) : url === roots[1] ? indexSet(2, 1) : pageSet(0, 1),
        finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [] }
    })
    const collecting = taskResources(roots.map(url => 'Sitemap: ' + url).join('\n'))
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      expect(fetchDocument.mock.calls.map(([url]) => url)).toEqual(roots)
    } finally { release(); await collecting }
    const resources = await collecting
    const expected = [...roots, PAGE + 's0.xml', PAGE + 's1.xml']
    expect(fetchDocument.mock.calls.map(([url]) => url)).toEqual(expected)
    expect(resources.sitemaps.map(document => document.url)).toEqual(expected)
    expect(resources.declaredSitemaps).toEqual([...expected, PAGE + 's2.xml'])
    expect(resources.complete).toBe(false)
  })

  it('retains a valid sitemap when robots also declares unusable locations', async () => {
    serve({})
    const resources = await taskResources(`Sitemap: /relative.xml\nSitemap: ftp://example.com/map.xml\nSitemap: ${PAGE}valid.xml`)
    expect(fetchDocument).toHaveBeenCalledExactlyOnceWith(PAGE + 'valid.xml', expect.anything())
    expect(resources).toMatchObject({ complete: false, declaredSitemaps: [PAGE + 'valid.xml'], sitemapUrls: [PAGE + 'p0'] })
  })

  it.each([404, 410])('does not Flag a declared sitemap when a challenge responds with HTTP %i', async statusCode => {
    fetchDocument.mockResolvedValue({ body: 'Verify you are human', finalUrl: PAGE + 'declared.xml', statusCode,
      headers: { 'cf-mitigated': 'challenge' }, complete: true, redirects: [] })
    const resources = await taskResources(`Sitemap: ${PAGE}declared.xml`)
    expect(resources.complete).toBe(false)
    const observations = await evaluateSearch(evidence(undefined, { ...resources, sitemapsComplete: resources.complete }), null, ['discovery'])
    expect(observations.find(item => item.checkId === 'sitemap-missing')).toMatchObject({ disposition: 'unknown', reason: 'public_access_challenge' })
    expect(searchFindings(observations)).toEqual([])
  })

  it('retains fallback membership without treating unreadable robots as complete discovery', async () => {
    serve({})
    const resources = await collectSiteResources(PAGE, Date.now() + 10_000, document(null, { status: 503 }))
    expect(resources).toMatchObject({ complete: false, sitemapUrls: [PAGE + 'p0'] })
    for (const [pageUrl, disposition] of [[PAGE, 'unknown'], [PAGE + 'p0', 'observed']] as const) {
      const observations = await evaluateSearch(evidence(undefined, { ...resources, pageUrl, sitemapsComplete: resources.complete }), null, ['discovery'])
      expect(observations.find(item => item.checkId === 'search-discovery-links')).toMatchObject({ disposition })
    }
  })

  it('keeps a missing declared file incomplete without treating an absent conventional file as an unread declaration', async () => {
    fetchDocument.mockImplementation(async (url: string) => ({ body: 'Not found', finalUrl: url,
      statusCode: 404, headers: {}, complete: true, redirects: [] }))
    expect((await collectSiteResources(PAGE, Date.now() + 5000, document(`Sitemap: ${PAGE}declared.xml`))).complete).toBe(false)
    expect((await collectSiteResources(PAGE, Date.now() + 5000, document('User-agent: *'))).complete).toBe(true)
  })

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
