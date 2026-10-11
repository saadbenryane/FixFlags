import { beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluateSearch, searchFindings } from '../registry'
import { searchReceiptSchema, type SearchReceipt } from '../contracts'
import { evidence, markup, PAGE, document } from './fixtures'

const db = vi.hoisted(() => ({
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
  return db.auditVerifierExecution.upsert.mock.calls.at(-1)?.[0].create.detail
}
beforeEach(() => {
  vi.clearAllMocks()
  db.audit.findUnique.mockResolvedValue({ parentId: 'source' })
  db.improvementAttempt.findMany.mockResolvedValue([])
  db.auditVerifierExecution.upsert.mockImplementation(async ({ create }) => ({ detail: create.detail }))
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

  it('does not replace a rendered title failure with original-HTML success when rendered collection fails', async () => {
    const broken = await receipt('<html><head></head><body>Page</body></html>')
    const flag = searchFindings(broken.observations).find(item => item.checkId === 'title-missing')!
    expect(flag.attentionPolicy?.sources).toEqual(['rendered-dom'])
    pending(flag.checkId, flag.attentionPolicy)
    await recordSearchVerifiers(await receipt(undefined, undefined, { rendered: document(null) }))
    expect(db.auditVerifierExecution.upsert).not.toHaveBeenCalled()
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
    expect(db.auditVerifierExecution.upsert).not.toHaveBeenCalled()
  })
  it('verifies repaired declared sitemap syntax and target availability using stable identities', async () => {
    for (const checkId of ['sitemap-missing', 'search-sitemap-invalid']) {
      pending(checkId, { policy: 'search', version: 1, kind: 'flag', reason: 'sitemap_unavailable' })
      await recordSearchVerifiers(await receipt(undefined, undefined, {
        sitemaps: [document('<urlset><url><loc>' + PAGE + '</loc></url></urlset>')],
      }))
      expect(proof()).toMatchObject({ checkId, verdict: 'passed', comparable: true })
    }
  })
  it('retains the originating receipt on a repeated persistence attempt', async () => {
    const first = await receipt()
    db.auditVerifierExecution.upsert.mockResolvedValueOnce({ detail: first })
    expect(await persistSearchReceipt(await receipt('<title>Changed later</title>'))).toEqual(first)
    expect(db.auditVerifierExecution.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: {} }))
  })
})

