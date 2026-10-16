import { afterEach, describe, expect, it, vi } from 'vitest'
import { entityValues, inspectFeature, inspectStructuredData, schemaDocumentLoader } from '../structured-data'
import { evaluateSearch, searchFindings } from '../registry'
import { document, evidence, markup } from './fixtures'
import { assessSearchRecovery } from '../recovery'

afterEach(() => vi.unstubAllGlobals())
describe('public structured-data inspection', () => {
  it('retains malformed JSON as evidence', async () => {
    const inspected = await inspectStructuredData(document('<script type="application/ld+json">{"@type":</script>'))
    expect(inspected.issues).toMatchObject([{ reason: 'invalid_json', excerpt: '{"@type":' }])
  })
  it('resolves graph references and nested entities', async () => {
    const inspected = await inspectStructuredData(document(markup({ '@context': 'https://schema.org', '@graph': [
      { '@id': '#product', '@type': 'Product', name: 'Example', offers: { '@id': '#offer' } },
      { '@id': '#offer', '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ] })))
    const product = inspected.entities.find(item => item.types.includes('Product'))!
    expect(entityValues(product, 'offers', inspected.entities)).toMatchObject([{ types: ['Offer'] }])
    expect(inspectFeature(product, 'Product', inspected.entities)).toMatchObject({ missing: [], invalid: [] })
  })
  it('supports arrays and multiple blocks sharing named entities', async () => {
    const inspected = await inspectStructuredData(document(
      markup([{ '@context': 'https://schema.org', '@id': '#org', '@type': 'Organization', name: 'Example' }]) +
      `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@id': '#org', url: 'https://example.com/' })}</script>`))
    const organization = inspected.entities.find(item => item.types.includes('Organization'))!
    expect(entityValues(organization, 'url', inspected.entities)).toEqual(['https://example.com/'])
  })
  it('parses nested Microdata', async () => {
    const inspected = await inspectStructuredData(document('<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">Example</span><div itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="price" content="12"></div></div>'))
    expect(inspected.entities.find(item => item.types.includes('Product'))).toMatchObject({ format: 'Microdata' })
    const product = inspected.entities.find(item => item.types.includes('Product'))!
    expect(inspectFeature(product, 'Product', inspected.entities)?.invalid).toEqual([])
  })
  it('parses RDFa without a JSON-LD block', async () => {
    const inspected = await inspectStructuredData(document('<div vocab="https://schema.org/" typeof="Organization"><span property="name">Example</span></div>'))
    expect(inspected.entities).toMatchObject([{ format: 'RDFa', types: ['Organization'] }])
  })
  it('never fetches page-controlled remote contexts', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(schemaDocumentLoader('https://attacker.example/context')).rejects.toThrow('unsupported_context')
    const inspected = await inspectStructuredData(document(markup({ '@context': 'https://attacker.example/context', '@type': 'Product' })))
    expect(inspected.complete).toBe(false)
    expect(inspected.issues[0].reason).toBe('unsupported_context')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('marks deep or oversized structures incomplete', async () => {
    let nested: unknown = 'value'
    for (let index = 0; index < 50; index++) nested = { child: nested }
    const inspected = await inspectStructuredData(document(markup(nested)))
    expect(inspected.issues[0].reason).toBe('parser_limit')
    expect(inspected.complete).toBe(false)
  })
  it('does not certify truncated source', async () => {
    expect(await inspectStructuredData(document(markup({ '@context': 'https://schema.org', '@type': 'Product' }), { complete: false })))
      .toMatchObject({ complete: false, entities: [] })
  })
  it('does not invent Organization or Article required properties', async () => {
    const inspected = await inspectStructuredData(document(markup([{ '@context': 'https://schema.org', '@type': 'Organization' },
      { '@context': 'https://schema.org', '@type': 'Article' }])))
    for (const entity of inspected.entities) expect(inspectFeature(entity, entity.types[0], inspected.entities)?.missing).toEqual([])
  })
  it('detects an invalid implemented price without making one up', async () => {
    const data = { '@context': 'https://schema.org', '@type': 'Product', name: 'Example', offers: { '@type': 'Offer', price: 'free' } }
    const result = await evaluateSearch(evidence(markup(data, '<h1>Example</h1>')))
    expect(searchFindings(result)).toContainEqual(expect.objectContaining({ checkId: 'search-structured-feature',
      attentionPolicy: expect.objectContaining({ kind: 'flag', entityTypes: ['Product'] }) }))
    expect(result.some(item => item.reason === 'markup_property_invalid')).toBe(true)
  })
  it('keeps Google eligibility gaps as guidance, never fabricated ratings', async () => {
    const result = await evaluateSearch(evidence(markup({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Example' }, '<h1>Example</h1>')))
    const feature = result.find(item => item.entityTypes?.includes('SoftwareApplication'))!
    expect(feature.attention.kind).toBe('recommendation')
    expect(feature.observed).toContain('review or aggregateRating')
    expect(feature.guidance).toContain('Never create ratings')
  })
  it('reports unsupported types without invented feature success', async () => {
    const result = await evaluateSearch(evidence(markup({ '@context': 'https://schema.org', '@type': 'Thing', name: 'Example' })))
    expect(result.filter(item => item.entityTypes?.includes('Thing')).every(item => item.disposition === 'not_applicable')).toBe(true)
  })
  it('detects injected markup separately from original HTML', async () => {
    const result = await evaluateSearch(evidence(undefined, { rendered: document(markup({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Example', url: 'https://example.com/' })) }))
    expect(result.find(item => item.entityTypes?.includes('WebSite') && item.source === 'rendered-dom')?.disposition).toBe('passed')
    expect(result.some(item => item.source === 'original-html' && item.reason === 'no_published_markup')).toBe(true)
  })
  it('does not recommend generic markup without matching page content', async () => {
    const result = await evaluateSearch(evidence('<html><head><title>Login</title></head><body><h1>Login</h1></body></html>', { pageUrl: 'https://example.com/login' }))
    expect(searchFindings(result).some(item => item.checkId === 'no-structured-data')).toBe(false)
  })
  it('does not use the JSON-LD script itself as visible-content proof', async () => {
    const result = await evaluateSearch(evidence(markup({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Unshown Organization', url: 'https://example.com/' }, '<h1>Different page</h1>')))
    expect(result.some(item => item.reason === 'content_correspondence_unconfirmed')).toBe(true)
  })
  it('verifies the original invalid property without borrowing another entity or requiring unrelated feature support', async () => {
    const input = (price: string, id = '#product') => evidence(markup({ '@context': 'https://schema.org', '@type': 'Product',
      '@id': id, name: 'Example', offers: { '@type': 'Offer', price } }, '<h1>Example</h1>'))
    const source = await evaluateSearch(input('free'), undefined, ['structured-data'])
    const flag = searchFindings(source).find(flag => flag.checkId === 'search-structured-feature')!
    expect(flag.attentionPolicy?.markupTargets).toHaveLength(2)
    for (const [price, id, verdict] of [['free', '#product', 'failed'], ['12', '#other', 'unknown'], ['12', '#product', 'passed']]) {
      const observations = await evaluateSearch(input(price, id), undefined, ['structured-data'])
      expect(observations.some(item => item.entityTypes?.includes('Offer') && item.disposition === 'not_applicable')).toBe(true)
      expect(assessSearchRecovery({ kind: 'search-checks', version: 1, auditId: 'after', pageUrl: input(price).pageUrl,
        collectedAt: new Date().toISOString(), complete: true, observations }, flag.checkId, flag.attentionPolicy).verdict).toBe(verdict)
    }
    const observations = await evaluateSearch(input('12'), undefined, ['structured-data'])
    const legacy = { ...flag.attentionPolicy!, markupTargets: undefined,
      pageScopes: flag.attentionPolicy!.pageScopes?.map(scope => ({ ...scope, markupTargets: undefined })) }
    expect(assessSearchRecovery({ kind: 'search-checks', version: 1, auditId: 'after', pageUrl: input('12').pageUrl,
      collectedAt: new Date().toISOString(), complete: true, observations }, flag.checkId, legacy).verdict).toBe('unknown')
  })
})
