import { afterAll, expect, it } from 'vitest'
import { closeParserWorker, evaluateSearchIsolated } from '../cpu'
import { document, evidence, PAGE } from '../../search/__tests__/fixtures'
import { collectSearchEvidence } from '../../search/collect'
import type { RenderedSearchSnapshot } from '../../search/rendered-snapshot'

afterAll(() => closeParserWorker())

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
