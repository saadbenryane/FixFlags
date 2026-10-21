// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { Page } from 'playwright'
import { collectRenderedSearchSnapshot } from '../rendered-snapshot'
import { evaluateSearch } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { document as recordedDocument, evidence, PAGE } from './fixtures'

const page = { evaluate: async (fn: () => unknown) => fn() } as unknown as Page
beforeEach(() => { document.documentElement.innerHTML = '<head></head><body></body>' })

describe('bounded rendered Search sections', () => {
  it('excludes dormant descendants before charging a section budget', async () => {
    document.head.innerHTML = '<title>Useful title</title><template><meta name="robots" content="noindex"></template>'
    const dormant = document.createElement('noscript')
    for (let index = 0; index < 100; index++) {
      const meta = document.createElement('meta')
      meta.name = 'robots'; meta.content = 'noindex'; dormant.append(meta)
    }
    document.body.append(dormant)
    const published = document.createElement('script')
    published.type = 'application/ld+json'; published.textContent = '{"@type":"Product"}'
    const hidden = document.createElement('div'); hidden.hidden = true; hidden.append(published)
    document.body.append(hidden)
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.sections.indexing).toMatchObject({ observed: 0, complete: true, html: '' })
    expect(snapshot.sections.structured).toMatchObject({ observed: 1, complete: true })
    expect(snapshot.sections.structured.html).toContain('Product')
    expect(snapshot.sections.metadata.html).not.toContain('noindex')
  })

  it('retains the native base for isolated canonical sections and fences earlier detector evidence', async () => {
    document.head.innerHTML = '<base href="https://example.com/catalog/"><link rel="canonical" href="item">'
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.documentBaseUrl).toBe('https://example.com/catalog/')
    const observations = await evaluateSearch(evidence('', { collectorVersion: 2, original: recordedDocument('<base href="/catalog/"><link rel="canonical" href="item">'),
      rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false }),
      canonicalTargets: [recordedDocument('Ready', { url: PAGE + 'catalog/item', finalUrl: PAGE + 'catalog/item' })] }), undefined, ['canonical'])
    expect(observations.find(item => item.checkId === 'search-canonical-target')).toMatchObject({ disposition: 'passed', checkVersion: 3,
      observed: PAGE + 'catalog/item: HTTP 200' })
    const receipt = { kind: 'search-checks' as const, version: 1 as const, auditId: 'new', pageUrl: PAGE,
      collectedAt: new Date().toISOString(), complete: true, observations }
    const policy = { policy: 'search', version: 2, kind: 'flag', reason: 'canonical_signals_conflict', sources: ['http'] }
    expect(assessSearchRecovery(receipt, 'search-canonical-conflict', policy)).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(assessSearchRecovery(receipt, 'search-canonical-conflict', { ...policy, version: 3 })).toMatchObject({ comparable: true, verdict: 'passed' })
    const { documentBaseUrl: omitted, ...historical } = snapshot
    void omitted
    const unavailable = await evaluateSearch(evidence('', { original: recordedDocument(null),
      rendered: recordedDocument(null, { searchSnapshot: historical, complete: false }) }), undefined, ['canonical'])
    expect(unavailable.find(item => item.checkId === 'search-canonical-conflict')).toMatchObject({ disposition: 'unknown' })
  })

  it('inspects useful Search evidence independently of a large hydration payload', async () => {
    document.head.innerHTML = '<title>Useful title</title><meta name="robots" content="index"><link rel="canonical" href="https://example.com/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Useful title"}</script>'
    document.body.innerHTML = '<h1>Useful title</h1><a href="/about">About</a><script>' + 'x'.repeat(1_100_000) + '</script>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(JSON.stringify(snapshot).length).toBeLessThan(10_000)
    expect(Object.values(snapshot.sections).every(section => section.complete)).toBe(true)
    const collected = evidence('', { collectorVersion: 2, rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false, reason: 'document_truncated' }) })
    const observations = await evaluateSearch(collected)
    expect(observations.find(item => item.checkId === 'title-missing' && item.source === 'rendered-dom')).toMatchObject({ disposition: 'passed', observed: 'Useful title', checkVersion: 3 })
    expect(observations.find(item => item.checkId === 'search-discovery-links')).toMatchObject({ source: 'rendered-dom', disposition: 'observed' })
    expect(observations.find(item => item.checkId === 'search-structured-invalid' && item.source === 'rendered-dom')).toMatchObject({ disposition: 'passed' })
    expect(collected.rendered.complete).toBe(false)
    expect(collected.rendered.body).toBeNull()
  })

  it('keeps exhausted link coverage unknown without discarding complete metadata', async () => {
    document.head.innerHTML = '<title>Useful title</title>'
    document.body.innerHTML = '<h1>Title</h1>' + Array.from({ length: 2001 }, (_, i) => `<a href="/${i}">Page</a>`).join('')
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.sections.links).toMatchObject({ complete: false, reason: 'section_limit', observed: 2001, limit: 2000 })
    expect(snapshot.sections.metadata.complete).toBe(true)
    const observations = await evaluateSearch(evidence('', { original: recordedDocument(null), collectorVersion: 2,
      rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false }) }))
    expect(observations.find(item => item.checkId === 'title-missing')).toMatchObject({ disposition: 'passed' })
    expect(observations.find(item => item.checkId === 'search-discovery-links')).toMatchObject({ disposition: 'unknown' })
  })

  it.each(['metadata', 'links', 'text'] as const)('retains structured markup results when the independent %s section is incomplete', async section => {
    document.head.innerHTML = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","@id":"#product","name":"Useful service","offers":{"@type":"Offer","price":"free"}}</script>' +
      '<script type="application/ld+json">{"@type":</script>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    snapshot.sections[section].complete = false
    snapshot.sections[section].reason = 'section_limit'
    const observations = await evaluateSearch(evidence('', { original: recordedDocument(null), collectorVersion: 2,
      rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false }) }), undefined, ['structured-data'])
    expect(observations.find(item => item.source === 'rendered-dom' && item.checkId === 'search-structured-invalid'))
      .toMatchObject({ disposition: 'failed', reason: 'markup_syntax_invalid' })
    expect(observations.find(item => item.source === 'rendered-dom' && item.checkId === 'search-structured-feature' && item.entityTypes?.includes('Product')))
      .toMatchObject({ disposition: 'failed', entityTypes: ['Product'], invalidProperties: ['offers.price'] })
    expect(observations.find(item => item.checkId === 'search-structured-content'))
      .toMatchObject({ disposition: 'unknown', reason: 'content_context_incomplete' })
  })

  it('does not certify historical recovery under the changed collector contract', async () => {
    document.head.innerHTML = '<title>Repaired title</title>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    const observations = await evaluateSearch(evidence('', { collectorVersion: 2, rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false }) }))
    const receipt = { kind: 'search-checks' as const, version: 1 as const, auditId: 'new', pageUrl: PAGE,
      collectedAt: new Date().toISOString(), complete: false, observations }
    const policy = { policy: 'search', version: 1, kind: 'flag', reason: 'title_empty', sources: ['rendered-dom'] }
    expect(assessSearchRecovery(receipt, 'title-missing', policy)).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(assessSearchRecovery(receipt, 'title-missing', { ...policy, version: 2 })).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(assessSearchRecovery(receipt, 'title-missing', { ...policy, version: 3 })).toMatchObject({ comparable: true, verdict: 'passed' })
  })
})
