import { describe, expect, it } from 'vitest'
import { evaluateSearch, searchFindings, SEARCH_CHECK_DEFINITIONS, validateSearchRegistration } from '../registry'
import { isCustomerFlag } from '../../attention'
import { searchReceiptSchema } from '../contracts'
import { document, evidence, markup, PAGE } from './fixtures'
import { assessSearchRecovery } from '../recovery'
import { observationsForFlag } from '../../flag-observations'

describe('Search responsibilities and classification', () => {
  it.each([403, 404, 429, 503])('does not mistake an HTTP %s error document for published page content', async status => {
    const unavailable = document('<html><head></head><body>Error</body></html>', { status })
    const result = await evaluateSearch(evidence(undefined, { original: unavailable, rendered: unavailable }))
    expect(result.find(item => item.checkId === 'search-http-access')?.observed).toContain(`HTTP ${status}`)
    for (const responsibility of ['presentation', 'structured-data']) {
      expect(result.filter(item => item.responsibility === responsibility).every(item => item.disposition === 'unknown')).toBe(true)
    }
    expect(result.find(item => item.checkId === 'h1-missing')).toMatchObject({ disposition: 'unknown', attention: { kind: 'observation' } })
    expect(result.some(item => item.checkId === 'h1-multiple')).toBe(false)
    expect(result.find(item => item.checkId === 'search-page-language')?.disposition).toBe('unknown')
    expect(result.find(item => item.checkId === 'search-structured-feature')).toMatchObject({ disposition: 'unknown', attention: { kind: 'observation' } })
    expect(searchFindings(result).some(item => ['title-missing', 'no-structured-data', 'h1-missing', 'h1-multiple', 'search-page-language', 'search-structured-feature', 'search-structured-invalid'].includes(item.checkId))).toBe(false)
  })
  it('does not treat an unread document as a heading or structured-data repair', async () => {
    const blocked = document('<html><body>Error</body></html>', { status: 403 })
    const unread = await evaluateSearch(evidence(undefined, { original: blocked, rendered: blocked }))
    const receipt = (observations: Awaited<ReturnType<typeof evaluateSearch>>, complete: boolean) => searchReceiptSchema.parse({
      kind: 'search-checks', version: 1, auditId: 'unread', pageUrl: PAGE, collectedAt: evidence().collectedAt, complete, observations })
    const headings = await evaluateSearch(evidence('<html lang="en"><head><title>Example website title</title><meta name="description" content="A useful description of the example website for visitors."></head><body><p>No heading</p></body></html>'), null, ['presentation'])
    const heading = headings.find(item => item.checkId === 'h1-missing')!
    expect(heading).toMatchObject({ disposition: 'observed', attention: { kind: 'recommendation' } })
    expect(isCustomerFlag(searchFindings(headings).find(item => item.checkId === 'h1-missing')!)).toBe(false)
    expect(assessSearchRecovery(receipt(unread, false), heading.checkId, heading.attention, PAGE)).toMatchObject({ comparable: false, verdict: 'unknown' })
    const repaired = await evaluateSearch(evidence('<html lang="en"><head><title>Example website title</title><meta name="description" content="A useful description of the example website for visitors."></head><body><h1>Example website</h1></body></html>'), null, ['presentation'])
    expect(assessSearchRecovery(receipt(repaired, true), heading.checkId, heading.attention, PAGE)).toMatchObject({ comparable: true, verdict: 'passed' })
    const product = (price: string) => markup({ '@context': 'https://schema.org', '@type': 'Product', '@id': '#product', name: 'Example', offers: { '@type': 'Offer', price } }, '<h1>Example</h1>')
    const broken = await evaluateSearch(evidence(product('free')), null, ['structured-data'])
    const flag = searchFindings(broken).find(item => item.checkId === 'search-structured-feature')!
    expect(flag.attentionPolicy?.kind).toBe('flag')
    expect(assessSearchRecovery(receipt(unread, false), flag.checkId, flag.attentionPolicy, PAGE)).toMatchObject({ comparable: false, verdict: 'unknown' })
    const fixed = await evaluateSearch(evidence(product('12')), null, ['structured-data'])
    expect(assessSearchRecovery(receipt(fixed, true), flag.checkId, flag.attentionPolicy, PAGE)).toMatchObject({ comparable: true, verdict: 'passed' })
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
  it('flags a confirmed sitemap conflict from headers when the document and other sitemap evidence are incomplete', async () => {
    const original = document(null, { reason: 'response_body_unavailable', headers: { 'x-robots-tag': 'googlebot: noindex' } })
    const result = await evaluateSearch(evidence(undefined, { original, sitemapUrls: [PAGE], sitemapsComplete: false }), null, ['indexing'])
    expect(result).toContainEqual(expect.objectContaining({ checkId: 'search-indexing-source', source: 'original-html', disposition: 'unknown' }))
    expect(result).toContainEqual(expect.objectContaining({ checkId: 'search-indexing-source', source: 'http', disposition: 'observed' }))
    expect(searchFindings(result)).toContainEqual(expect.objectContaining({ checkId: 'robots-blocks-indexing',
      attentionPolicy: expect.objectContaining({ reason: 'sitemap_indexing_conflict' }) }))
  })
  it.each([{ status: 206 }, { status: 403 }, { reason: 'public_access_challenge' }, { reason: 'public_sign_in_redirect' }])(
    'does not use indexing headers on an unavailable response: %j', async unavailable => {
      const original = document(null, { ...unavailable, headers: { 'x-robots-tag': 'noindex' } })
      const result = await evaluateSearch(evidence(undefined, { original, sitemapUrls: [PAGE] }), null, ['indexing'])
      expect(result.find(item => item.checkId === 'robots-blocks-indexing')).toMatchObject({ disposition: 'observed', reason: 'indexing_comparison_incomplete' })
      expect(searchFindings(result)).toEqual([])
    })
  it('does not erase an original noindex removed by JavaScript', async () => {
    const result = await evaluateSearch(evidence(undefined, { original: document('<meta name="robots" content="noindex">') }))
    expect(result.find(item => item.checkId === 'robots-blocks-indexing')?.reason).toBe('declared_indexing_exclusion')
  })
  it('keeps rendered directives while withholding unmatched browser headers and a clean comparison', async () => {
    const rendered = document('<title>Catalog</title>', { headers: { 'x-robots-tag': 'noindex' } })
    const result = await evaluateSearch(evidence(undefined, { rendered, renderedResponseScoped: false, sitemapUrls: [PAGE] }), null, ['indexing'])
    expect(result).toContainEqual(expect.objectContaining({ checkId: 'search-indexing-source', source: 'rendered-dom', disposition: 'observed' }))
    expect(result).toContainEqual(expect.objectContaining({ checkId: 'search-indexing-source', source: 'http',
      disposition: 'unknown', reason: 'rendered_response_scope_unavailable' }))
    expect(result.find(item => item.checkId === 'robots-blocks-indexing')).toMatchObject({ disposition: 'observed', reason: 'indexing_comparison_incomplete' })
    expect(searchFindings(result)).toEqual([])
  })
  it('can use a bound browser response header independently of its HTML', async () => {
    const rendered = document(null, { headers: { 'x-robots-tag': 'noindex' } })
    const result = await evaluateSearch(evidence(undefined, { rendered, renderedResponseScoped: true, sitemapUrls: [PAGE] }), null, ['indexing'])
    expect(searchFindings(result)).toContainEqual(expect.objectContaining({ checkId: 'robots-blocks-indexing' }))
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
  it('does not treat partial page markup, headers or robots rules as Search evidence', async () => {
    const original = document('<meta name="robots" content="noindex">', { status: 206, headers: { link: '</ignored>; rel=canonical' } })
    const rendered = document('<title>Partial title</title><link rel="canonical" href="/ignored">', { status: 206 })
    const robots = document('User-agent: *\nAllow: /', { status: 206, url: PAGE + 'robots.txt', finalUrl: PAGE + 'robots.txt' })
    const result = await evaluateSearch(evidence(undefined, { original, rendered, robots, sitemapUrls: [PAGE] }), null,
      ['presentation', 'indexing', 'canonical', 'crawl'])
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkId: 'title-missing', disposition: 'unknown' }),
      expect.objectContaining({ checkId: 'robots-blocks-indexing', disposition: 'unknown' }),
      expect.objectContaining({ checkId: 'search-crawl-access', disposition: 'unknown' }),
    ]))
    expect(result.some(item => item.checkId === 'search-canonical-target')).toBe(false)
    expect(searchFindings(result)).toEqual([])
  })
  it.each(['https://cdn.example.net/rules.txt', 'http://example.com/rules.txt', 'https://example.com:8443/rules.txt'])
    ('applies redirected robots rules to their original authority: %s', async finalUrl => {
      const url = PAGE + 'robots.txt'
      const evaluate = (body: string) => evaluateSearch(evidence(undefined, { robots: document(body, {
        url, finalUrl, redirects: [url], headers: { 'content-type': 'text/plain' },
      }) }), null, ['crawl'])
      expect((await evaluate('User-agent: *\nAllow: /')).find(item => item.checkId === 'search-crawl-access'))
        .toMatchObject({ disposition: 'passed', reason: 'crawl_allowed', evidence: [{ url: finalUrl }] })
      expect((await evaluate('User-agent: *\nDisallow: /')).find(item => item.checkId === 'search-crawl-access'))
        .toMatchObject({ disposition: 'observed', reason: 'declared_crawl_restriction', evidence: [{ url: finalUrl }] })
    })
  it('compares each observed redirect hop with its own robots authority and keeps repair scoped', async () => {
    const sameHost = PAGE + 'redirect', target = 'https://example.net/final?mode=public', targetRobots = 'https://example.net/robots.txt'
    const read = async (rules: string, finalUrl = target, previous?: ReturnType<typeof searchReceiptSchema.parse>) => {
      const base = evidence(undefined, {
        original: document('<title>Destination</title>', { finalUrl, redirects: [PAGE, sameHost] }),
        redirectRobots: [document(rules, { url: targetRobots, finalUrl: targetRobots })],
      })
      return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: base.auditId, pageUrl: PAGE,
        collectedAt: base.collectedAt, complete: true, observations: await evaluateSearch(base, previous, ['crawl']) })
    }
    const allowed = await read('User-agent: *\nAllow: /')
    expect(allowed.observations.filter(item => item.checkId === 'search-crawl-access').map(item => item.disposition)).toEqual(['passed', 'passed', 'passed'])
    const blocked = await read('User-agent: *\nDisallow: /final', target, allowed)
    const flag = searchFindings(blocked.observations).find(flag => flag.checkId === 'search-crawl-access')!
    expect(flag.evidence).toContain('https://example.net/final')
    expect(flag.evidence).not.toContain('mode=public')
    expect(assessSearchRecovery(blocked, flag.checkId, flag.attentionPolicy, PAGE)).toMatchObject({ comparable: true, verdict: 'failed' })
    const initialOnlyPolicy = { policy: 'search', version: 1, kind: 'flag', reason: 'crawl_policy_regressed', sources: ['robots-txt'] }
    expect(assessSearchRecovery(blocked, flag.checkId, initialOnlyPolicy, PAGE)).toMatchObject({ comparable: true, verdict: 'passed' })
    const changed = await read('User-agent: *\nAllow: /', 'https://example.net/other', blocked)
    expect(assessSearchRecovery(changed, flag.checkId, flag.attentionPolicy, PAGE)).toMatchObject({ comparable: false, verdict: 'unknown' })
    const repaired = await read('User-agent: *\nAllow: /', target, blocked)
    expect(assessSearchRecovery(repaired, flag.checkId, flag.attentionPolicy, PAGE)).toMatchObject({ comparable: true, verdict: 'passed' })
  })

  it.each([200, 404])('does not borrow another initial authority\'s robots response: HTTP %s', async status => {
    const result = await evaluateSearch(evidence(undefined, { robots: document('User-agent: *\nAllow: /', {
      url: 'https://other.example.net/robots.txt', finalUrl: PAGE + 'robots.txt', status,
      redirects: ['https://other.example.net/robots.txt'],
    }) }), null, ['crawl'])
    expect(result.find(item => item.checkId === 'search-crawl-access')?.disposition).toBe('unknown')
  })
  it('preserves direct-rule recovery semantics when the same robots request moves to another host', async () => {
    const read = async (body: string, finalUrl = PAGE + 'robots.txt', previous?: ReturnType<typeof searchReceiptSchema.parse>) => {
      const input = evidence(undefined, { robots: document(body, { url: PAGE + 'robots.txt', finalUrl,
        redirects: finalUrl === PAGE + 'robots.txt' ? [] : [PAGE + 'robots.txt'] }) })
      const observations = await evaluateSearch(input, previous, ['crawl'])
      return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'robots', pageUrl: PAGE,
        collectedAt: input.collectedAt, complete: !observations.some(item => item.disposition === 'unknown'), observations })
    }
    const before = await read('User-agent: *\nAllow: /')
    const failed = await read('User-agent: *\nDisallow: /', undefined, before)
    const flag = searchFindings(failed.observations).find(flag => flag.checkId === 'search-crawl-access')!
    expect(flag).toBeDefined()
    const repaired = await read('User-agent: *\nAllow: /', 'https://cdn.example.net/rules.txt')
    expect(assessSearchRecovery(repaired, flag.checkId, flag.attentionPolicy, PAGE)).toMatchObject({ comparable: true, verdict: 'passed' })
    const blocked = await read('User-agent: *\nDisallow: /', 'https://cdn.example.net/rules.txt', before)
    expect(assessSearchRecovery(blocked, flag.checkId, flag.attentionPolicy, PAGE)).toMatchObject({ comparable: true, verdict: 'failed' })
  })
  it('keeps parser resource limits unknown instead of diagnosing a valid sitemap as broken', async () => {
    const sitemap = document('<urlset>' + '<extension>'.repeat(300) + 'content' + '</extension>'.repeat(300) + '</urlset>',
      { url: PAGE + 'sitemap.xml' })
    const result = await evaluateSearch(evidence(undefined, { sitemaps: [sitemap], declaredSitemaps: [sitemap.url], sitemapsComplete: false }), null, ['discovery'])
    expect(result.find(item => item.checkId === 'search-sitemap-invalid'))
      .toMatchObject({ disposition: 'unknown', reason: 'sitemap_parse_unavailable' })
    expect(searchFindings(result)).toEqual([])
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
  it('does not count a sign-in redirect as a reachable canonical target', async () => {
    const target = PAGE + 'article', login = PAGE + 'login'
    const body = '<link rel="canonical" href="/article">'
    const signIn = document('<title>Sign in to continue</title>', { url: target, finalUrl: login, redirects: [target] })
    const observations = await evaluateSearch(evidence(body, { canonicalTargets: [signIn] }), null, ['canonical'])
    expect(observations.find(item => item.checkId === 'search-canonical-target')).toMatchObject({ disposition: 'unknown' })
    expect(searchFindings(observations)).toEqual([])
  })
  it.each([[206, null, 'unknown'], [404, 'response_body_unavailable', 'failed'], [410, 'document_truncated', 'failed']] as const)(
    'classifies canonical HTTP %s using the recorded response status and collection result', async (status, reason, disposition) => {
      const target = PAGE + 'article'
      const canonical = document('Observed response bytes', { url: target, finalUrl: target, status, reason, complete: reason === null })
      const observations = await evaluateSearch(evidence('<link rel="canonical" href="/article">', { canonicalTargets: [canonical] }), null, ['canonical'])
      expect(observations.find(item => item.checkId === 'search-canonical-target'))
        .toMatchObject({ disposition, observed: target + ': HTTP ' + status })
    })
  it.each([[200, 'unknown'], [404, 'failed']] as const)('keeps exact HTTP %s evidence honest when a Link field is partially parsed', async (status, disposition) => {
    const body = '<link rel="canonical" href="/article">', target = PAGE + 'article'
    const link = '</article>; rel=canonical, </unread>; title="unfinished'
    const original = document(body, { headers: { link } })
    const canonicalTarget = document('Canonical article response', { url: target, finalUrl: target, status })
    const observations = await evaluateSearch(evidence(body, { original, canonicalTargets: [canonicalTarget] }), null, ['canonical'])
    expect(observations.find(item => item.checkId === 'search-canonical-invalid' && item.source === 'http')?.disposition).toBe('unknown')
    expect(observations.find(item => item.checkId === 'search-canonical-conflict')?.disposition).toBe('observed')
    expect(observations.find(item => item.checkId === 'search-canonical-target')?.disposition).toBe(disposition)
  })
  it('records a public HTTP canonical when the response body is unavailable', async () => {
    const target = PAGE + 'article'
    const original = document(null, { headers: { link: '</article>; rel="alternate canonical"' }, reason: 'response_body_unavailable' })
    const missing = document(null, { url: target, finalUrl: target, status: 404, complete: true })
    const observations = await evaluateSearch(evidence(undefined, { original, canonicalTargets: [missing] }), null, ['canonical'])
    expect(observations.find(item => item.checkId === 'search-canonical-target')).toMatchObject({ disposition: 'failed', observed: target + ': HTTP 404' })
  })
  it('verifies corrected canonical syntax only after inspecting every originally failing source', async () => {
    const checkId = 'search-canonical-invalid'
    const invalid = '<link rel="canonical" href="javascript:invalid">'
    const valid = '<link rel="canonical" href="/">'
    const baseline = await evaluateSearch(evidence(invalid, { original: document(invalid, { headers: { link: '<ftp://example.com/>; rel=canonical' } }) }),
      null, ['canonical'])
    const policy = searchFindings(baseline).find(item => item.checkId === checkId)?.attentionPolicy
    expect(policy?.sources).toEqual(['original-html', 'http', 'rendered-dom'])
    const receipt = async (rendered: ReturnType<typeof document>) => {
      const input = evidence(valid, { rendered })
      return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: input.auditId, pageUrl: PAGE,
        collectedAt: input.collectedAt, complete: rendered.complete, observations: await evaluateSearch(input, null, ['canonical']) })
    }
    expect(assessSearchRecovery(await receipt(document(null)), checkId, policy)).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(assessSearchRecovery(await receipt(document(invalid)), checkId, policy)).toMatchObject({ comparable: true, verdict: 'failed' })
    expect(assessSearchRecovery(await receipt(document(valid)), checkId, policy)).toMatchObject({ comparable: true, verdict: 'passed' })
  })
  it.each(['failed', 'unknown'] as const)('keeps a canonical target %s despite another target redirecting there', async disposition => {
    const alias = PAGE + 'alias', target = PAGE + 'article'
    const redirected = document('Reached via the alias', { url: alias, finalUrl: target, redirects: [target] })
    const exact = document(null, { url: target, finalUrl: target, status: disposition === 'failed' ? 404 : null,
      complete: disposition === 'failed' })
    const observations = await evaluateSearch(evidence('<link rel="canonical" href="/alias"><link rel="canonical" href="/article">',
      { canonicalTargets: [redirected, exact] }), null, ['canonical'])
    expect(observations.find(item => item.id === 'search-canonical-target:' + alias)?.disposition).toBe('passed')
    expect(observations.find(item => item.id === 'search-canonical-target:' + target)?.disposition).toBe(disposition)
  })
  it('requires every originally failed canonical target for repair and never substitutes another declaration', async () => {
    const first = PAGE + 'article?lang=en', second = PAGE + 'guide', replacement = PAGE + 'article?lang=fr'
    const receiptFor = async (targets: Array<[string, number | null]>) => {
      const input = evidence(targets.map(([url]) => '<link rel="canonical" href="' + url + '">').join(''),
        { canonicalTargets: targets.map(([url, status]) => document('Observed response', { url, finalUrl: url, status, complete: status !== null })) })
      return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: input.auditId, pageUrl: PAGE,
        collectedAt: input.collectedAt, complete: true, observations: await evaluateSearch(input, null, ['canonical']) })
    }
    const original = await receiptFor([[first, 404], [second, 404]])
    const flag = searchFindings(original.observations).find(flag => flag.checkId === 'search-canonical-target')!
    expect(flag.attentionPolicy).toMatchObject({ resourceKeys: [expect.any(String), expect.any(String)],
      pageScopes: [{ pageUrl: PAGE, resourceKeys: [expect.any(String), expect.any(String)] }] })
    const verify = async (targets: Array<[string, number | null]>) =>
      assessSearchRecovery(await receiptFor(targets), flag.checkId, flag.attentionPolicy, PAGE)
    expect(await verify([[replacement, 200], [second, 200]])).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(await verify([[first, 404], [second, null], [replacement, 200]])).toMatchObject({ comparable: true, verdict: 'failed' })
    expect(await verify([[second, 200], [first, 200], [replacement, null]])).toMatchObject({ comparable: true, verdict: 'passed' })

    const { resourceKeys, pageScopes, ...legacyPolicy } = flag.attentionPolicy!
    expect(resourceKeys).toHaveLength(2)
    expect(pageScopes).toHaveLength(1)
    const source = observationsForFlag({ ...flag, attentionPolicy: legacyPolicy }, {
      auditId: 'original', taskId: 'original-canonical', checkVersion: 1, collectedAt: original.collectedAt,
    }).items[0]
    const verifyLegacy = async (targets: Array<[string, number | null]>, retained = source) => {
      const current = await receiptFor(targets)
      // v5 used the requested URL in its ID but stored no resource key.
      const historical = { ...current, observations: current.observations.map(item => item.checkId === flag.checkId
        ? { ...item, resourceKey: undefined, ...(item.observed.endsWith(': HTTP 206')
          ? { disposition: 'passed' as const, reason: 'canonical_target_reachable' } : {}) } : item) }
      return assessSearchRecovery(historical, flag.checkId, legacyPolicy, PAGE, [PAGE], retained)
    }
    expect(await verifyLegacy([[replacement, 200], [second, 200]])).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(await verifyLegacy([[first, 206], [second, 200]])).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(await verifyLegacy([[first, 404], [second, null]])).toMatchObject({ comparable: true, verdict: 'failed' })
    expect(await verifyLegacy([[first, 200], [second, 200]])).toMatchObject({ comparable: true, verdict: 'passed' })
    expect(await verifyLegacy([[first, 200], [second, 200]], { ...source, provenance: null })).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(await verifyLegacy([[first, 200], [second, 200]], { ...source, evidence: source.evidence + '\nTruncated record' }))
      .toMatchObject({ comparable: false, verdict: 'unknown' })
  })
  it('reuses the completed public navigation response at its final URL', async () => {
    const target = PAGE + 'article'
    const body = '<link rel="canonical" href="/article">'
    const observations = await evaluateSearch(evidence(body, { original: document(body, { finalUrl: target, redirects: [target] }) }), null, ['canonical'])
    expect(observations.find(item => item.id === 'search-canonical-target:' + target)?.disposition).toBe('passed')
  })
  it('prefers a fresh canonical request over a retained copy of the original redirect', async () => {
    const target = PAGE + 'article', body = '<link rel="canonical" href="/"><link rel="canonical" href="/article">'
    const original = document(body, { finalUrl: target, redirects: [target] })
    const direct = document('The original URL is gone', { status: 404 })
    const observations = await evaluateSearch(evidence(body, { original, canonicalTargets: [{ ...original }, direct] }), null, ['canonical'])
    expect(observations.find(item => item.id === 'search-canonical-target:' + PAGE)?.disposition).toBe('failed')
    expect(observations.find(item => item.id === 'search-canonical-target:' + target)?.disposition).toBe('passed')
  })
  it('does not expose credentialed capture as public Search evidence', async () => {
    const result = await evaluateSearch(evidence(undefined, { public: false }))
    expect(result.every(item => item.disposition === 'unknown')).toBe(true)
    expect(searchFindings(result)).toEqual([])
  })
  it('keeps a captured original page when the rendered copy is missing', async () => {
    const rendered = document(null, { complete: false, reason: 'document_truncated' })
    const original = '<html><head><title>Useful title</title><meta name="description" content="Useful description"><link rel="canonical" href="https://example.com/"></head><body><h1>Useful title</h1></body></html>'
    const observations = await evaluateSearch(evidence(original, { rendered, collectorVersion: 2 }))
    expect(observations.find(item => item.checkId === 'title-missing' && item.source === 'original-html')).toMatchObject({ disposition: 'passed', observed: 'Useful title' })
    expect(observations.find(item => item.checkId === 'description-missing' && item.source === 'original-html')).toMatchObject({ disposition: 'passed' })
    expect(observations.find(item => item.checkId === 'title-missing' && item.source === 'rendered-dom')).toMatchObject({ disposition: 'unknown', reason: 'document_truncated' })
    expect(observations.find(item => item.checkId === 'description-missing' && item.source === 'rendered-dom')?.disposition).toBe('unknown')
    expect(observations.find(item => item.checkId === 'search-original-title')).toBeUndefined()
    expect(observations.find(item => item.checkId === 'search-canonical-invalid' && item.source === 'http')).toMatchObject({ disposition: 'passed', reason: 'canonical_declarations_parsed' })
    expect(observations.find(item => item.checkId === 'search-canonical-invalid' && item.source === 'rendered-dom')).toMatchObject({ disposition: 'unknown' })
    expect(observations.find(item => item.checkId === 'search-canonical-conflict')).toMatchObject({ disposition: 'observed', reason: 'canonical_comparison_incomplete' })
    expect(observations.find(item => item.checkId === 'search-indexing-source' && item.source === 'original-html')).toMatchObject({ disposition: 'observed' })
    expect(observations.find(item => item.checkId === 'search-indexing-source' && item.source === 'rendered-dom')).toMatchObject({ disposition: 'unknown', reason: 'document_truncated' })
    expect(observations.find(item => item.checkId === 'robots-blocks-indexing')).toMatchObject({ disposition: 'observed', reason: 'indexing_comparison_incomplete' })
    expect(observations.find(item => item.checkId === 'search-structured-invalid' && item.source === 'original-html')?.disposition).not.toBe('unknown')
    expect(observations.find(item => item.checkId === 'search-structured-invalid' && item.source === 'rendered-dom')).toMatchObject({ disposition: 'unknown' })
    expect(observations.find(item => item.source === 'rendered-dom' && item.disposition === 'passed')).toBeUndefined()
  })
  it('keeps incomplete sitemap membership unknown and does not certify a later listing', async () => {
    const page = '<html><head><title>Page</title></head><body><a href="/pricing">Pricing</a></body></html>'
    const read = (overrides: Parameters<typeof evidence>[1]) => evaluateSearch(evidence(page, overrides), null, ['discovery'])
    const membership = (observations: Awaited<ReturnType<typeof read>>) => observations.find(item => item.checkId === 'search-discovery-links')
    const partial = await read({ sitemapUrls: [], sitemapsComplete: false })
    expect(membership(partial)).toMatchObject({ disposition: 'unknown', reason: 'sitemap_coverage_incomplete' })
    expect(searchFindings(partial).some(item => item.checkId === 'search-discovery-links')).toBe(false)
    const listedPartial = await read({ sitemapUrls: [PAGE], sitemapsComplete: false })
    expect(membership(listedPartial)).toMatchObject({ disposition: 'observed', reason: 'checked_page_discovery_recorded' })
    const unlisted = membership(await read({ sitemapUrls: [], sitemapsComplete: true }))!
    expect(unlisted).toMatchObject({ disposition: 'observed', reason: 'checked_page_discovery_recorded' })
    expect(unlisted.disposition).not.toBe('passed')
    const receipt = (observations: Awaited<ReturnType<typeof read>>, complete: boolean) => searchReceiptSchema.parse({
      kind: 'search-checks', version: 1, auditId: 'discovery', pageUrl: PAGE, collectedAt: evidence().collectedAt, complete, observations })
    expect(assessSearchRecovery(receipt(listedPartial, false), unlisted.checkId, unlisted.attention, PAGE)).toMatchObject({ comparable: false, verdict: 'unknown' })
    const listed = await read({ sitemapUrls: [PAGE], sitemapsComplete: true })
    expect(assessSearchRecovery(receipt(listed, true), unlisted.checkId, unlisted.attention, PAGE)).toMatchObject({ comparable: false, verdict: 'unknown' })
  })
  it('preserves accepted unrelated Flag eligibility', () => {
    for (const checkId of ['security-csp-missing', 'journey-signup-nav-broken'])
      expect(isCustomerFlag({ checkId, severity: 'IMPORTANT', confidence: 1 })).toBe(true)
    for (const checkId of ['messaging-weak-value-prop', 'trust-no-authority-signals', 'journey-first-visit-hidden-cta'])
      expect(isCustomerFlag({ checkId, severity: 'CRITICAL', confidence: 1 })).toBe(false)
    expect(isCustomerFlag({ checkId: 'description-missing', severity: 'IMPORTANT', confidence: 1 })).toBe(false)
  })
})
