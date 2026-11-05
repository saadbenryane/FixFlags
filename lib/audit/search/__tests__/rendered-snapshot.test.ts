// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page } from 'playwright'
import { collectRenderedSearchSnapshot } from '../rendered-snapshot'
import { evaluateSearch } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { document as recordedDocument, evidence, PAGE } from './fixtures'
import { capturedSectionLinks, capturedSectionScope } from '../../checks/section-links'
import { runAllChecks } from '../../checks'
import { scopedAssertionForTarget } from '../../checks/verification'
import { capturedPageLinks } from '../../checks/public-links'
import { runAuthCheckoutChecks } from '../../checks/auth-checkout'

const page = { evaluate: async (fn: () => unknown) => fn() } as unknown as Page
beforeEach(() => { document.documentElement.innerHTML = '<head></head><body></body>' })

describe('bounded rendered Search sections', () => {
  it('evaluates an exhausted native section from the complete same-capture document while preserving partial-body uncertainty', async () => {
    document.head.innerHTML = '<meta name="fixture" content="bounded">'.repeat(257) + '<title>Actual page title</title><meta name="description" content="Actual page description">'
    document.body.innerHTML = '<h1>Actual page title</h1>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.sections.metadata.complete).toBe(false)
    const body = document.documentElement.outerHTML
    const complete = await evaluateSearch(evidence('', { original: recordedDocument(null), collectorVersion: 2,
      rendered: recordedDocument(body, { searchSnapshot: snapshot }) }), undefined, ['presentation'])
    expect(complete.find(item => item.checkId === 'title-missing'))
      .toMatchObject({ disposition: 'passed', source: 'rendered-dom', observed: 'Actual page title' })
    expect(complete.find(item => item.checkId === 'description-missing'))
      .toMatchObject({ disposition: 'passed', source: 'rendered-dom', observed: 'Actual page description' })
    const partial = await evaluateSearch(evidence('', { original: recordedDocument(null), collectorVersion: 2,
      rendered: recordedDocument(body, { searchSnapshot: snapshot, complete: false }) }), undefined, ['presentation'])
    expect(partial.find(item => item.checkId === 'title-missing')).toMatchObject({ disposition: 'unknown' })
  })
  it('uses complete page prose for structured content matching instead of treating selected sections as the whole page', async () => {
    document.head.innerHTML = '<title>Product details</title><script type="application/ld+json">' +
      JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: 'The useful service', offers: { '@type': 'Offer', price: '12' } }) + '</script>'
    document.body.innerHTML = '<h1>Product details</h1><p>The useful service</p>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.sections.text.html).not.toContain('The useful service')
    const complete = await evaluateSearch(evidence('', { original: recordedDocument(null), collectorVersion: 2,
      rendered: recordedDocument(document.documentElement.outerHTML, { searchSnapshot: snapshot }) }), undefined, ['structured-data'])
    expect(complete.filter(item => item.checkId === 'search-structured-content')).toEqual([])
    const partial = await evaluateSearch(evidence('', { original: recordedDocument(null), collectorVersion: 2,
      rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false }) }), undefined, ['structured-data'])
    expect(partial.filter(item => item.checkId === 'search-structured-content'))
      .toMatchObject([{ disposition: 'unknown', reason: 'content_context_incomplete' }])
    expect(partial.some(item => item.checkId === 'search-structured-feature' && item.source === 'rendered-dom')).toBe(true)
    document.querySelector('p')!.remove()
    const mismatch = await evaluateSearch(evidence('', { original: recordedDocument(null), collectorVersion: 2,
      rendered: recordedDocument(document.documentElement.outerHTML, { searchSnapshot: snapshot }) }), undefined, ['structured-data'])
    expect(mismatch.filter(item => item.checkId === 'search-structured-content'))
      .toMatchObject([{ disposition: 'observed', reason: 'content_correspondence_unconfirmed' }])
  })
  it('never invents an action label by cutting a longer word at its classification boundary', async () => {
    document.body.innerHTML = '<a href="/offer">' + ' '.repeat(247) + 'Subscribers</a><a href="/other-offer">Subscribe</a>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    const inventory = capturedPageLinks({ renderedSearchSnapshot: snapshot }, null, { requireLabels: true })
    const openDestination = vi.fn(async (url: string) => ({ url, status: 404, outcome: 'not_found' as const, shouldFlagDead: true }))
    const flags = await runAuthCheckoutChecks(location.href, inventory, { openDestination })
    expect(openDestination.mock.calls.map(([url]) => url)).toEqual([new URL('/other-offer', location.href).href])
    expect(flags).toMatchObject([{ checkId: 'checkout-link-dead', evidenceTargets: [{ context: expect.any(String) }] }])
  })
  it('retains href coverage while disclosing clipped action labels', async () => {
    document.body.innerHTML = '<a href="/offer">' + 'x'.repeat(300) + ' Subscribe</a><template><a href="/checkout">Buy now</a></template>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.sections.links).toMatchObject({ complete: true, labelsComplete: false, observed: 1 })
    expect(snapshot.sections.links.html).not.toContain('Subscribe')
    document.body.innerHTML = '<a href="/offer">Subscribe</a>'
    expect((await collectRenderedSearchSnapshot(page)).sections.links).toMatchObject({ complete: true, labelsComplete: true })
  })
  it('collects exact active fragment targets independently of oversized page HTML', async () => {
    document.body.innerHTML = '<a href="#Pricing">Pricing</a><a href="#caf%C3%A9">Details</a><a href="#missing">Missing</a>' +
      '<section id="Pricing"></section><a name="café">Details</a><template><section id="missing"></section></template>' +
      '<div hidden>' + 'x'.repeat(1_100_000) + '</div>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.sectionLinks).toMatchObject({ complete: true, elementIds: ['Pricing'], anchorNames: ['café'], links: [
      { href: '#Pricing' }, { href: '#caf%C3%A9' }, { href: '#missing' },
    ] })
    expect(JSON.stringify(snapshot.sectionLinks).length).toBeLessThan(2000)
  })
  it('detects and independently verifies sections without full metadata while heading evidence remains unknown', async () => {
    document.body.innerHTML = '<a href="#Pricing">Pricing</a><a href="#caf%C3%A9">Details</a><a name="café">Details</a>'
    const scope = { pageUrl: location.href, finalUrl: location.href, profile: 'desktop-fixture', access: 'public' }
    async function checked(auditId: string) {
      const snapshot = await collectRenderedSearchSnapshot(page)
      const captured = { renderedSearchSnapshot: snapshot, runtimeHeadScope: scope }
      const sectionScope = capturedSectionScope(captured)
      expect(sectionScope).toEqual(scope)
      const inventory = capturedSectionLinks(captured, null, sectionScope)
      const result = await runAllChecks(scope.pageUrl, null, null, null, [], undefined, null, null, undefined, true, ['seo'],
        { sectionLinks: inventory, sectionScope })
      return { result, receipt: { kind: 'site-module-check' as const, version: 1 as const, module: 'seo', pageUrl: scope.pageUrl,
        ...result.executions[0], execution: { auditId, taskId: 'native-sections-' + auditId, checkVersion: 1, source: 'rendered-dom' as const, collectedAt: snapshot.collectedAt } } }
    }
    const before = await checked('before')
    expect(before.result.flags).toMatchObject([{ checkId: 'broken-page-anchors' }])
    expect(before.receipt).toMatchObject({ complete: false, assertions: [
      { passed: false, complete: true }, { passed: true, complete: true },
    ] })
    document.body.insertAdjacentHTML('beforeend', '<section id="Pricing"></section>')
    const after = await checked('after')
    expect(after.result.flags).toEqual([])
    expect(after.receipt.complete).toBe(false)
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: 'broken-page-anchors', flag: before.result.flags[0] })?.assertion)
      .toMatchObject({ complete: true, passed: true })
  })
  it('retains bounded exact observations while refusing completion beyond the native target budget', async () => {
    document.body.innerHTML = Array.from({ length: 301 }, (_, index) => '<a href="#section-' + index + '">Details</a>').join('')
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.sectionLinks).toMatchObject({ complete: false, elementIds: [], anchorNames: [] })
    expect(snapshot.sectionLinks?.links).toHaveLength(300)
    expect(capturedSectionLinks({ renderedSearchSnapshot: snapshot, collectionRestrictions: ['read_only_refusal'] }, null)).toBeNull()
    expect(capturedSectionLinks({ renderedSearchSnapshot: snapshot }, null, { pageUrl: location.href, finalUrl: 'https://other.example/', profile: 'desktop', access: 'public' })).toBeNull()
    expect(capturedSectionScope({ renderedSearchSnapshot: snapshot, runtimeHeadScope: { pageUrl: location.href, finalUrl: 'https://other.example/', profile: 'desktop', access: 'public' } })).toBeUndefined()
  })
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
