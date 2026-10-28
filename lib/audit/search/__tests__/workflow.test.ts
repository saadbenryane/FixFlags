import { beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluateSearch, searchFindings } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { searchReceiptSchema, type SearchReceipt } from '../contracts'
import { evidence, markup, PAGE, document } from './fixtures'

const db = vi.hoisted(() => ({get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },
  audit: { findUnique: vi.fn() },
  improvementAttempt: { findMany: vi.fn() },
  auditVerifierExecution: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma: db }))
import { combineSearchReceipts, priorSearchReceipt, recordSearchVerifiers, persistSearchReceipt } from '../workflow'

async function receipt(body?: string, previous?: SearchReceipt, overrides = {}) {
  const input = evidence(body, overrides)
  return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'verification', pageUrl: PAGE,
    collectedAt: input.collectedAt, complete: true, observations: await evaluateSearch(input, previous) })
}
function pending(checkId: string, policy: unknown) {
  db.improvementAttempt.findMany.mockResolvedValue([{ improvement: { occurrences: [{ flag: {
    checkId, attentionPolicy: policy, pageUrl: PAGE, fingerprint: checkId, source: 'DETERMINISTIC',
  } }] } }])
}
function proof() {
  return db.auditVerificationReceipt.upsert.mock.calls.at(-1)?.[0].create.detail
}
beforeEach(() => {
  vi.clearAllMocks()
  db.audit.findUnique.mockResolvedValue({ parentId: 'source' })
  db.improvementAttempt.findMany.mockResolvedValue([])
  db.auditVerificationReceipt.upsert.mockImplementation(async ({ create }) => ({ detail: create.detail }))
})
describe('fresh Search verification and history', () => {
  it('preserves previous progressive evaluator receipts for policy regression checks', async () => {
    const before = await receipt()
    db.auditVerifierExecution.findUnique.mockResolvedValue(null)
    db.auditVerifierExecution.findMany.mockResolvedValue([{ detail: before }])
    const saved = await priorSearchReceipt('verification', PAGE)
    expect(saved?.observations).toEqual(before.observations)
    expect(saved?.complete).toBe(false)
    const after = await receipt('<title>Page</title><meta name="robots" content="noindex">', saved ?? undefined)
    expect(after.observations.find(item => item.checkId === 'robots-blocks-indexing')?.reason).toBe('indexing_policy_regressed')
  })
  it('bounds aggregate observations without erasing the source receipts or claiming completeness', async () => {
    const source = await receipt()
    const template = source.observations[0]
    const parts = [0, 1].map(part => ({ ...source, observations: Array.from({ length: 300 }, (_, index) => ({ ...template, id: `part:${part}:${index}` })) }))
    const summary = combineSearchReceipts({ auditId: source.auditId, pageUrl: PAGE, receipts: parts, expected: 2 })
    expect(summary.observations).toHaveLength(500)
    expect(summary.complete).toBe(false)
    expect(summary.observations.at(-1)?.reason).toBe('observation_limit')
    expect(parts[1].observations).toHaveLength(300)
  })

  it('uses the full receipt capacity without declaring a gap and keeps late failures in larger summaries', async () => {
    const source = await receipt()
    const template = source.observations.find(item => item.disposition === 'passed')!
    const parts = [0, 1].map(part => ({ ...source, observations: Array.from({ length: 250 }, (_, index) => ({ ...template, id: `part:${part}:${index}` })) }))
    const complete = combineSearchReceipts({ auditId: source.auditId, pageUrl: PAGE, receipts: parts, expected: 2 })
    expect(complete.complete).toBe(true)
    expect(complete.observations).toHaveLength(500)
    const failure = { ...template, id: 'late-failure', disposition: 'failed' as const,
      attention: { ...template.attention, kind: 'flag' as const } }
    parts[1].observations.push(failure)
    const partial = combineSearchReceipts({ auditId: source.auditId, pageUrl: PAGE, receipts: parts, expected: 2 })
    expect(partial.complete).toBe(false)
    expect(partial.observations).toContainEqual(failure)
    expect(partial.observations.at(-1)?.reason).toBe('observation_limit')
  })

  it('does not replace a rendered title failure with original-HTML success when rendered collection fails', async () => {
    const broken = await receipt('<html><head></head><body>Page</body></html>')
    const flag = searchFindings(broken.observations).find(item => item.checkId === 'title-missing')!
    expect(flag.attentionPolicy?.sources).toEqual(['rendered-dom'])
    pending(flag.checkId, flag.attentionPolicy)
    await recordSearchVerifiers(await receipt(undefined, undefined, { rendered: document(null) }))
    expect(proof()).toMatchObject({ verdict: 'unknown', comparable: false })
    await recordSearchVerifiers(await receipt())
    expect(proof()).toMatchObject({ verdict: 'passed', comparable: true })
  })
  it('keeps failure through unrepaired verification, records recovery, and detects recurrence', async () => {
    const healthy = await receipt()
    const broken = await receipt('<title>Page</title><meta name="robots" content="noindex">', healthy)
    const flag = searchFindings(broken.observations).find(item => item.checkId === 'robots-blocks-indexing')!
    pending(flag.checkId, flag.attentionPolicy)
    const unrepaired = await receipt('<title>Page</title><meta name="robots" content="noindex">', broken)
    await recordSearchVerifiers(unrepaired)
    expect(proof()).toMatchObject({ verdict: 'failed', comparable: true })
    const repaired = await receipt(undefined, unrepaired)
    await recordSearchVerifiers(repaired)
    expect(proof()).toMatchObject({ verdict: 'passed', comparable: true })
    const recurrence = await receipt('<title>Page</title><meta name="robots" content="noindex">', repaired)
    expect(searchFindings(recurrence.observations).find(item => item.checkId === flag.checkId)?.attentionPolicy?.kind).toBe('flag')
  })
  it('does not certify a disappearing title failure from incomplete capture', async () => {
    pending('title-missing', { policy: 'search', version: 1, kind: 'flag', reason: 'title_empty' })
    const partial = await receipt(undefined, undefined, { original: document(null), rendered: document(null) })
    await recordSearchVerifiers(partial)
    expect(proof()).toMatchObject({ verdict: 'unknown', comparable: false })
  })
  it('verifies an invalid property independently of remaining eligibility recommendations', async () => {
    const bad = { '@context': 'https://schema.org', '@type': 'Product', '@id': PAGE + '#product',
      name: 'Example website', url: 'not a URL' }
    const broken = await receipt(markup(bad))
    const flag = searchFindings(broken.observations).find(item => item.checkId === 'search-structured-feature')!
    expect(flag.attentionPolicy?.markupTargets?.length).toBe(2)
    pending(flag.checkId, flag.attentionPolicy)
    const fixed = await receipt(markup({ ...bad, url: PAGE }), broken)
    expect(searchFindings(fixed.observations).find(item => item.checkId === flag.checkId)?.attentionPolicy?.kind).toBe('recommendation')
    await recordSearchVerifiers(fixed)
    expect(proof()).toMatchObject({ verdict: 'passed', comparable: true })
  })
  it('cannot certify a removed entity as a property repair', async () => {
    const broken = await receipt(markup({ '@context': 'https://schema.org', '@type': 'Product', '@id': PAGE + '#product', url: 'bad' }))
    const flag = searchFindings(broken.observations).find(item => item.checkId === 'search-structured-feature')!
    pending(flag.checkId, flag.attentionPolicy)
    await recordSearchVerifiers(await receipt())
    expect(db.auditVerificationReceipt.upsert).not.toHaveBeenCalled()
  })
  it('verifies repaired declared sitemap syntax and target availability using stable identities', async () => {
    for (const checkId of ['sitemap-missing', 'search-sitemap-invalid']) {
      const sitemapUrl = PAGE + 'sitemap.xml'
      const broken = await receipt(undefined, undefined, {
        sitemaps: [document(checkId === 'sitemap-missing' ? null : '<urlset><url>',
          { url: sitemapUrl, finalUrl: sitemapUrl, status: checkId === 'sitemap-missing' ? 404 : 200, complete: true })],
        declaredSitemaps: [sitemapUrl],
      })
      const flag = searchFindings(broken.observations).find(flag => flag.checkId === checkId)!
      pending(checkId, flag.attentionPolicy)
      await recordSearchVerifiers(await receipt(undefined, undefined, {
        sitemaps: [document('<urlset><url><loc>' + PAGE + '</loc></url></urlset>', { url: sitemapUrl, finalUrl: sitemapUrl })],
      }))
      expect(proof()).toMatchObject({ checkId, verdict: 'passed', comparable: true })
    }
  })
  it('does not certify the old escaped request target as repaired by a parser correction', async () => {
    const originalTarget = PAGE + 'pages.xml?page=2&amp;type=product'
    const correctedTarget = PAGE + 'pages.xml?page=2&type=product'
    const before = await receipt(undefined, undefined, {
      sitemaps: [document(null, { url: originalTarget, finalUrl: originalTarget, status: 404, complete: true })],
      declaredSitemaps: [originalTarget],
    })
    const flag = searchFindings(before.observations).find(item => item.checkId === 'sitemap-missing')!
    pending(flag.checkId, flag.attentionPolicy)
    const corrected = await receipt(undefined, undefined, {
      sitemaps: [document('<urlset><url><loc>' + PAGE + '</loc></url></urlset>', { url: correctedTarget, finalUrl: correctedTarget })],
      declaredSitemaps: [correctedTarget],
    })
    expect(assessSearchRecovery(corrected, flag.checkId, flag.attentionPolicy)).toMatchObject({ verdict: 'unknown', comparable: false })
    await recordSearchVerifiers(corrected)
    expect(db.auditVerificationReceipt.upsert).not.toHaveBeenCalled()
    expect(flag.evidence).toContain(originalTarget)
  })
  it('retains the originating receipt on a repeated persistence attempt', async () => {
    const first = await receipt()
    db.auditVerificationReceipt.upsert.mockResolvedValueOnce({ detail: first })
    expect(await persistSearchReceipt(await receipt('<title>Changed later</title>'))).toEqual(first)
    expect(db.auditVerificationReceipt.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: {} }))
  })
})

