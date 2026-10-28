import { afterAll, expect, it, vi } from 'vitest'
import { closeParserWorker, evaluateSearchIsolated, parseMetadataIsolated } from '../cpu'
import { document, evidence, PAGE } from '../../search/__tests__/fixtures'
import { collectSearchEvidence } from '../../search/collect'
import type { RenderedSearchSnapshot } from '../../search/rendered-snapshot'
import { withExecutionOwnership, ExecutionOwnershipLost } from '../../execution-ownership'

vi.mock('@/lib/db', () => ({ prisma: { audit: {
  updateMany: vi.fn(async () => ({ count: 1 })), findFirst: vi.fn(async () => ({ id: 'parser-owner' })),
} } }))

afterAll(() => closeParserWorker())

it('terminates a canceled native parser and then parses fresh evidence', async () => {
  await closeParserWorker()
  const controller = new AbortController()
  const obsolete = withExecutionOwnership({ auditId: 'parser-owner', token: 'attempt', generation: 1, signal: controller.signal }, () =>
    parseMetadataIsolated('<h1>Obsolete observation</h1>', PAGE, Date.now() + 10_000))
  const rejected = expect(obsolete).rejects.toBeInstanceOf(ExecutionOwnershipLost)
  await new Promise<void>(resolve => setImmediate(resolve))
  controller.abort()
  await rejected
  expect(await parseMetadataIsolated('<h1>Current observation</h1>', PAGE, Date.now() + 10_000))
    .toMatchObject({ h1s: ['Current observation'] })
}, 15_000)

it('keeps rendered and crawler metadata distinct across calls to the real parser worker', async () => {
  const html = '<main><h1>Useful service</h1></main><noscript><form><input><button>Sign up</button></form></noscript>' +
    '<template><a href="/checkout">Buy now</a></template>'
  const rendered = await parseMetadataIsolated(html, PAGE, Date.now() + 10_000, 'rendered')
  expect(rendered).toMatchObject({ forms: 0, totalFormInputs: 0, links: [], ctaTexts: [] })
  const crawler = await parseMetadataIsolated(html, PAGE, Date.now() + 10_000)
  expect(crawler!.forms).toBe(1)
  expect(crawler!.links).toHaveLength(1)
}, 25_000)

it('reports a metadata inventory bound without confusing it with a parser crash or losing later observations', async () => {
  expect(await parseMetadataIsolated('<main><h1>Useful service</h1>' + '<a href="/details">Details</a>'.repeat(10_001) + '</main>', PAGE, Date.now() + 10_000)).toBeNull()
  expect(await parseMetadataIsolated('<h1>Useful service</h1>', PAGE, Date.now() + 10_000)).toMatchObject({ h1s: ['Useful service'] })
}, 25_000)

it('passes evaluator selection through the real bounded parser worker', async () => {
  const observations = await evaluateSearchIsolated(evidence(), null, Date.now() + 10_000, ['crawl'])
  expect(observations.map(item => item.checkId)).toEqual(['search-http-access', 'search-crawl-access'])
  expect(observations.every(item => item.responsibility === 'crawl')).toBe(true)
}, 15_000)

it('keeps fresh HTTP evidence separate across repeated parser calls', async () => {
  const started = performance.now()
  const body = '<html><head><title>Scoped website</title></head><body><h1>Scoped website</h1></body></html>'
  for (const [index, status] of [200, 503, 200, 503].entries()) {
    const observations = await evaluateSearchIsolated(evidence(body, { auditId: `scoped-${index}`, original: document(body, { status }) }),
      null, Date.now() + 10_000, ['crawl'])
    const response = observations.find(item => item.checkId === 'search-http-access')!
    expect(response.observed).toContain(`HTTP ${status}`)
    expect(response.disposition).toBe('observed')
  }
  console.info(`Parser execution proof: four scoped calls completed in ${Math.round(performance.now() - started)} ms`)
}, 45_000)

it('replaces a real failed parser worker before accepting valid evidence again', async () => {
  await expect(evaluateSearchIsolated(evidence(undefined, { sitemapUrls: ['not-a-url'] }), null, Date.now() + 10_000, ['crawl']))
    .rejects.toMatchObject({ code: 'PARSER_CRASH' })
  const observations = await evaluateSearchIsolated(evidence(), null, Date.now() + 10_000, ['crawl'])
  expect(observations.map(item => item.checkId)).toEqual(['search-http-access', 'search-crawl-access'])
}, 25_000)

it.each([1, 2] as const)('evaluates actual collector output through the parser contract: version %s', async collectorVersion => {
  const body = '<html><head><title>Raw fallback</title></head><body><h1>Website</h1></body></html>'
  const section = { html: '<head><title>Bounded title</title></head><body><h1>Website</h1></body>', complete: true, reason: null, observed: 1, limit: 100 }
  const snapshot: RenderedSearchSnapshot = { version: 1, contract: 'rendered-search-v1', finalUrl: PAGE,
    collectedAt: new Date().toISOString(), language: 'en',
    sections: { metadata: section, indexing: section, canonical: section, structured: section, links: section, text: section } }
  const resources = evidence()
  const collected = await collectSearchEvidence({ auditId: 'collector-contract', pageUrl: PAGE, collectorVersion,
    original: document(null), renderedHtml: body, renderedComplete: true, status: 200, finalUrl: PAGE,
    renderedSearchSnapshot: collectorVersion === 2 ? snapshot : undefined,
    deadline: Date.now() + 5000, collectCanonicalTargets: false,
    cache: new Map([[new URL(PAGE).origin, Promise.resolve({ robots: resources.robots, sitemaps: resources.sitemaps,
      sitemapUrls: [], complete: true, declaredSitemaps: [] })]]) })
  const observations = await evaluateSearchIsolated(collected, null, Date.now() + 10_000, ['presentation'])
  expect(observations.find(item => item.checkId === 'title-missing' && item.source === 'rendered-dom')).toMatchObject({
    disposition: 'passed', observed: collectorVersion === 2 ? 'Bounded title' : 'Raw fallback' })
}, 15_000)
