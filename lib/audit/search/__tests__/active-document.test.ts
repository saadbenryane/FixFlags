import { describe, expect, it } from 'vitest'
import { evaluateSearch, searchFindings } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { inspectStructuredData } from '../structured-data'
import { document, evidence, PAGE } from './fixtures'

const dormant = '<template><meta name="robots" content="noindex"><script type="application/ld+json">{broken}</script>' +
  '<section itemscope itemtype="https://schema.org/Product"><span itemprop="name">Dormant product</span></section>' +
  '<section vocab="https://schema.org/" typeof="Product"><span property="name">Dormant RDFa</span></section></template>'
const content = (head = '', body = '') => '<!doctype html><html><head><title>Useful service</title>' + head +
  '</head><body><h1>Useful service</h1>' + body + '</body></html>'
const receipt = (observations: Awaited<ReturnType<typeof evaluateSearch>>) => ({ kind: 'search-checks' as const, version: 1 as const,
  auditId: 'after', pageUrl: PAGE, collectedAt: new Date().toISOString(), complete: true, observations })

describe('active public Search document', () => {
  it('ignores inert indexing and structured markup without rewriting the original evidence', async () => {
    const source = evidence(content(dormant), { collectorVersion: 2, sitemapUrls: [PAGE] })
    const original = source.original.body
    const observations = await evaluateSearch(source)
    expect(observations.find(item => item.checkId === 'robots-blocks-indexing'))
      .toMatchObject({ disposition: 'passed', reason: 'no_index_restrictions', checkVersion: 3 })
    expect(observations.filter(item => item.checkId === 'search-structured-invalid'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ disposition: 'not_applicable', reason: 'no_published_markup' })]))
    expect(searchFindings(observations).filter(item => ['robots-blocks-indexing', 'search-structured-invalid', 'search-structured-feature'].includes(item.checkId)))
      .toEqual([])
    expect(await inspectStructuredData(source.original)).toMatchObject({ blocks: 0, entities: [], issues: [], complete: true })
    expect(source.original.body).toBe(original)
  })

  it('retains active body directives and hidden published markup while excluding dormant fragments', async () => {
    const source = evidence(content(dormant, '<meta name="robots" content="noindex"><div hidden>' +
      '<script type="application/ld+json">{bad}</script></div>'), { sitemapUrls: [PAGE] })
    const observations = await evaluateSearch(source)
    const flags = searchFindings(observations)
    expect(flags.find(item => item.checkId === 'robots-blocks-indexing')?.attentionPolicy?.reason).toBe('sitemap_indexing_conflict')
    expect(flags.find(item => item.checkId === 'search-structured-invalid')).toBeDefined()
    expect(await inspectStructuredData(source.original)).toMatchObject({ blocks: 1, entities: [], complete: true,
      issues: [expect.objectContaining({ reason: 'invalid_json', excerpt: '{bad}' })] })
  })

  it.each(['Microdata', 'RDFa'] as const)('excludes dormant %s properties from an active entity', async format => {
    const body = format === 'Microdata'
      ? '<section itemscope itemtype="https://schema.org/Product" itemid="#product"><span itemprop="name">Active product</span><template><meta itemprop="url" content="not a URL"></template></section>'
      : '<section vocab="https://schema.org/" typeof="Product" resource="#product"><span property="name">Active product</span><template><meta property="url" content="not a URL"></template></section>'
    const inspection = await inspectStructuredData(document(content('', body)))
    expect(inspection).toMatchObject({ complete: true, issues: [] })
    const product = inspection.entities.find(entity => entity.types.includes('Product'))!
    expect(product.properties.name).toBeDefined()
    expect(product.properties.url).toBeUndefined()
    const clean = await inspectStructuredData(document(body.replace(/<template>[\s\S]*?<\/template>/, '')))
    const original = await inspectStructuredData(document(body))
    expect(original.entities).toEqual(clean.entities)
  })

  it('does not credit a detector correction as a historical repair', async () => {
    const observations = await evaluateSearch(evidence(content(), { collectorVersion: 2 }), null, ['indexing'])
    const original = { policy: 'search', version: 2, kind: 'flag', reason: 'indexing_policy_regressed', sources: ['http'] }
    expect(assessSearchRecovery(receipt(observations), 'robots-blocks-indexing', original))
      .toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(assessSearchRecovery(receipt(observations), 'robots-blocks-indexing', { ...original, version: 3 }))
      .toMatchObject({ comparable: true, verdict: 'passed' })
  })
})
