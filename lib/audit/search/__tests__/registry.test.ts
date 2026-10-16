import { describe, expect, it } from 'vitest'
import { evaluateSearch, searchFindings, SEARCH_CHECK_DEFINITIONS, validateSearchRegistration } from '../registry'
import { isCustomerFlag } from '../../attention'
import { searchReceiptSchema } from '../contracts'
import { document, evidence, PAGE } from './fixtures'

describe('Search responsibilities and classification', () => {
  it.each([403, 404, 429, 503])('does not mistake an HTTP %s error document for published page content', async status => {
    const unavailable = document('<html><head></head><body>Error</body></html>', { status })
    const result = await evaluateSearch(evidence(undefined, { original: unavailable, rendered: unavailable }))
    expect(result.find(item => item.checkId === 'search-http-access')?.observed).toContain(`HTTP ${status}`)
    for (const responsibility of ['presentation', 'structured-data']) {
      expect(result.filter(item => item.responsibility === responsibility).every(item => item.disposition === 'unknown')).toBe(true)
    }
    expect(searchFindings(result).some(item => ['title-missing', 'no-structured-data'].includes(item.checkId))).toBe(false)
  })
  it('separate evaluator execution preserves every original observation and finding', async () => {
    const input = evidence('<title>Page</title><meta name="robots" content="noindex"><link rel="canonical" href="https://example.com/">', { sitemapUrls: [PAGE] })
    const full = await evaluateSearch(input)
    const parts = (await Promise.all(SEARCH_CHECK_DEFINITIONS.map(definition => evaluateSearch(input, null, [definition.id.slice(7)])))).flat()
    expect(parts).toEqual(full)
    expect(searchFindings(parts)).toEqual(searchFindings(full))
  })

  it('rejects duplicate registrations and missing evaluators', () => {
    expect(() => validateSearchRegistration([SEARCH_CHECK_DEFINITIONS[0], SEARCH_CHECK_DEFINITIONS[0]])).toThrow()
    expect(() => validateSearchRegistration([{ ...SEARCH_CHECK_DEFINITIONS[0], evaluate: undefined } as never])).toThrow()
  })
  it('keeps a missing title prominent and descriptions advisory', async () => {
    const findings = searchFindings(await evaluateSearch(evidence('<html><head></head><body>Public page</body></html>')))
    expect(isCustomerFlag(findings.find(item => item.checkId === 'title-missing')!)).toBe(true)
    expect(isCustomerFlag(findings.find(item => item.checkId === 'description-missing')!)).toBe(false)
  })
  it('records deliberate noindex without instructing removal', async () => {
    const result = await evaluateSearch(evidence('<html><head><title>Page</title><meta name="ROBOTS" content="NONE"></head><body></body></html>'))
    const policy = result.find(item => item.checkId === 'robots-blocks-indexing')!
    expect(policy).toMatchObject({ disposition: 'observed', reason: 'declared_indexing_exclusion', attention: { kind: 'observation' } })
    expect(policy.guidance).toContain('Do not remove noindex')
  })
  it('honors generic and Googlebot-specific headers without borrowing another crawler’s rules', async () => {
    for (const [header, excluded] of [['noindex', true], ['otherbot: noindex', false], ['googlebot: noindex', true], ['max-snippet:50, noindex', true]] as const) {
      const base = evidence()
      base.original.headers['x-robots-tag'] = header
      const result = await evaluateSearch(base)
      expect(result.find(item => item.checkId === 'robots-blocks-indexing')?.reason === 'declared_indexing_exclusion').toBe(excluded)
    }
  })
  it('does not erase an original noindex removed by JavaScript', async () => {
    const result = await evaluateSearch(evidence(undefined, { original: document('<meta name="robots" content="noindex">') }))
    expect(result.find(item => item.checkId === 'robots-blocks-indexing')?.reason).toBe('declared_indexing_exclusion')
  })
  it('flags a proved sitemap/directive conflict with its policy receipt', async () => {
    const result = await evaluateSearch(evidence('<title>Page</title><meta name="robots" content="noindex">', { sitemapUrls: [PAGE] }))
    const flag = searchFindings(result).find(item => item.checkId === 'robots-blocks-indexing')!
    expect(isCustomerFlag(flag)).toBe(true)
    expect(flag.attentionPolicy?.reason).toBe('sitemap_indexing_conflict')
  })
  it('flags an independently captured indexing-policy regression', async () => {
    const previousEvidence = evidence()
    const previous = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'previous', pageUrl: PAGE,
      collectedAt: previousEvidence.collectedAt, complete: true, observations: await evaluateSearch(previousEvidence) })
    const result = await evaluateSearch(evidence('<title>Page</title><meta name="robots" content="noindex">'), previous)
    expect(result.find(item => item.checkId === 'robots-blocks-indexing')?.reason).toBe('indexing_policy_regressed')
  })
  it('evaluates applicable Googlebot rule specificity', async () => {
    const result = await evaluateSearch(evidence(undefined, { robots: document('User-agent: *\nDisallow: /\nUser-agent: Googlebot\nAllow: /') }))
    expect(result.find(item => item.checkId === 'search-crawl-access')?.reason).toBe('crawl_allowed')
  })
  it('does not turn robots server failure into permission to crawl', async () => {
    const result = await evaluateSearch(evidence(undefined, { robots: document('server failure', { status: 503 }) }))
    expect(result.find(item => item.checkId === 'search-crawl-access')?.disposition).toBe('unknown')
  })
  it('allows a reachable cross-domain canonical', async () => {
    const target = document('Public article', { url: 'https://publisher.example/article', finalUrl: 'https://publisher.example/article' })
    const result = await evaluateSearch(evidence('<title>Article</title><link rel="canonical" href="https://publisher.example/article">', { canonicalTargets: [target] }))
    expect(result.find(item => item.checkId === 'search-canonical-target')?.disposition).toBe('passed')
    expect(searchFindings(result).some(item => item.checkId === 'search-canonical-conflict')).toBe(false)
  })
  it('flags conflicting canonical declarations and malformed URLs', async () => {
    const result = await evaluateSearch(evidence('<title>Page</title><link rel="canonical" href="/a"><link rel="canonical" href="/b"><link rel="canonical" href="javascript:bad">'))
    expect(searchFindings(result).map(item => item.checkId)).toContain('search-canonical-conflict')
    expect(searchFindings(result).map(item => item.checkId)).toContain('search-canonical-invalid')
  })
  it('does not call a failed target fetch a broken canonical', async () => {
    const result = await evaluateSearch(evidence('<title>Page</title><link rel="canonical" href="/other">'))
    expect(result.find(item => item.checkId === 'search-canonical-target')?.disposition).toBe('unknown')
  })
  it('does not expose credentialed capture as public Search evidence', async () => {
    const result = await evaluateSearch(evidence(undefined, { public: false }))
    expect(result.every(item => item.disposition === 'unknown')).toBe(true)
    expect(searchFindings(result)).toEqual([])
  })
  it('preserves accepted unrelated Flag eligibility', () => {
    for (const checkId of ['security-csp-missing', 'journey-first-visit-hidden-cta'])
      expect(isCustomerFlag({ checkId, severity: 'IMPORTANT', confidence: 1 })).toBe(true)
    for (const checkId of ['messaging-weak-value-prop', 'trust-no-authority-signals'])
      expect(isCustomerFlag({ checkId, severity: 'CRITICAL', confidence: 1 })).toBe(false)
    expect(isCustomerFlag({ checkId: 'description-missing', severity: 'IMPORTANT', confidence: 1 })).toBe(false)
  })
})
