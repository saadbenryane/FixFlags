import { describe, expect, it } from 'vitest'
import { evaluateSearch, searchFindings } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { mergeSearchAttentionPolicies } from '../attention-scope'
import { searchReceiptSchema, type PublicDocument } from '../contracts'
import { document, evidence, PAGE } from './fixtures'
import { recordedVerificationVerdict } from '../../recovery-evidence'

const first = PAGE + 'first.xml', second = PAGE + 'second.xml', replacement = PAGE + 'replacement.xml'
function sitemap(url: string, state: 'valid' | 'invalid' | 'missing' | 'unavailable') {
  return document(state === 'valid' ? `<urlset><url><loc>${PAGE}</loc></url></urlset>` : state === 'invalid' ? '<urlset><url>' : null,
    { url, finalUrl: url, status: state === 'missing' ? 404 : state === 'unavailable' ? null : 200, complete: state !== 'unavailable' })
}
async function receipt(documents: PublicDocument[], pageUrl = PAGE) {
  const input = evidence('<title>Website</title>', { pageUrl, sitemaps: documents,
    declaredSitemaps: documents.map(item => item.url), sitemapsComplete: documents.every(item => item.complete) })
  return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'resource-scope', pageUrl,
    collectedAt: input.collectedAt, complete: input.sitemapsComplete, observations: await evaluateSearch(input, null, ['discovery']) })
}

describe('sitemap recovery preserves original resources', () => {
  it('requires the new syntax contract before a supported text file can verify a syntax repair', async () => {
    const text = { ...sitemap(first, 'valid'), body: PAGE + 'pricing', headers: { 'content-type': 'text/plain' } }
    const after = await receipt([text])
    const before = await receipt([{ ...text, body: '/relative' }])
    const flag = searchFindings(before.observations).find(flag => flag.checkId === 'search-sitemap-invalid')!
    expect(flag.attentionPolicy?.version).toBe(6)
    expect(assessSearchRecovery(after, flag.checkId, flag.attentionPolicy)).toMatchObject({ comparable: true, verdict: 'passed' })
    const xmlPolicy = searchFindings((await receipt([sitemap(first, 'invalid')])).observations)
      .find(flag => flag.checkId === 'search-sitemap-invalid')!.attentionPolicy!
    const historical = { ...xmlPolicy, version: 2, pageScopes: xmlPolicy.pageScopes?.map(scope => ({ ...scope, version: 2 })) }
    expect(assessSearchRecovery(after, flag.checkId, historical)).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(assessSearchRecovery(await receipt([sitemap(first, 'valid')]), flag.checkId, historical)).toMatchObject({ comparable: true, verdict: 'passed' })
  })
  it('keeps a missing sitemap open when its replacement response is not usable discovery data', async () => {
    const missing = searchFindings((await receipt([sitemap(first, 'missing')])).observations).find(flag => flag.checkId === 'sitemap-missing')!
    const wrongStructure = { ...sitemap(first, 'valid'), body: '<urlset><sitemap><loc>https://example.com/pages.xml</loc></sitemap></urlset>' }
    const current = await receipt([wrongStructure])
    expect(current.observations.find(item => item.checkId === 'search-sitemap-invalid')).toMatchObject({ disposition: 'failed', reason: 'sitemap_invalid_structure' })
    expect(assessSearchRecovery(current, missing.checkId, missing.attentionPolicy)).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(assessSearchRecovery(await receipt([sitemap(first, 'valid')]), missing.checkId, missing.attentionPolicy))
      .toMatchObject({ comparable: true, verdict: 'passed' })
  })
  it('retains an observed missing sitemap through an interrupted body but refuses an access challenge', async () => {
    const missing = sitemap(first, 'missing')
    const interrupted = { ...missing, complete: false, reason: 'response_body_unavailable' }
    const prior = searchFindings((await receipt([missing])).observations).find(flag => flag.checkId === 'sitemap-missing')!
    const current = await receipt([interrupted])
    expect(searchFindings(current.observations)).toContainEqual(expect.objectContaining({
      checkId: 'sitemap-missing', evidence: expect.stringContaining('HTTP 404'),
    }))
    expect(assessSearchRecovery(current, prior.checkId, prior.attentionPolicy)).toMatchObject({ comparable: true, verdict: 'failed' })
    const challenged = await receipt([{ ...interrupted, headers: { 'cf-mitigated': 'challenge' } }])
    expect(assessSearchRecovery(challenged, prior.checkId, prior.attentionPolicy)).toMatchObject({ comparable: false, verdict: 'unknown' })
  })

  it('preserves every admitted resource in the repair evidence when their URLs exceed a display excerpt', async () => {
    const urls = Array.from({ length: 5 }, (_, index) => PAGE + 'sitemap-' + index + '-' + 'path'.repeat(450) + '.xml')
    const before = await receipt(urls.map(url => sitemap(url, 'invalid')))
    const flag = searchFindings(before.observations).find(flag => flag.checkId === 'search-sitemap-invalid')!
    for (const url of urls) expect(flag.evidence).toContain(url)
    expect(flag.attentionPolicy?.resourceKeys).toHaveLength(5)
  })

  it.each([
    ['search-sitemap-invalid', 'invalid'], ['sitemap-missing', 'missing'],
  ] as const)('requires every original resource for %s, regardless of inventory order', async (checkId, state) => {
    const before = await receipt([sitemap(first, state), sitemap(second, state)])
    const flag = searchFindings(before.observations).find(flag => flag.checkId === checkId)!
    expect(flag).toBeDefined()
    expect(flag.attentionPolicy?.resourceKeys).toHaveLength(2)
    expect(flag.evidence).toContain(first)
    expect(flag.evidence).toContain(second)
    const verdict = (current: Awaited<ReturnType<typeof receipt>>) => recordedVerificationVerdict({
      auditId: current.auditId, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: PAGE,
        environment: 'production', checks: { [checkId]: checkId === 'search-sitemap-invalid' ? 2 : 1 }, outcomes: [], verificationTarget: null }, flag,
      executions: [{ targetKey: 'module:search-discovery', status: 'COMPLETED', detail: current }],
    })
    for (const documents of [
      [sitemap(replacement, 'valid')], [sitemap(first, 'valid')],
      [sitemap(first, 'valid'), sitemap(second, 'unavailable')],
      [sitemap(first + '?version=changed', 'valid'), sitemap(second, 'valid')],
    ]) {
      const current = await receipt(documents)
      expect(assessSearchRecovery(current, checkId, flag.attentionPolicy)).toMatchObject({ comparable: false, verdict: 'unknown' })
      expect(verdict(current)).toBeNull()
    }
    const stillBroken = await receipt([sitemap(second, 'unavailable'), sitemap(first, state)])
    const exactFailure = stillBroken.observations.find(item => item.checkId === checkId && item.disposition === 'failed')!
    expect(assessSearchRecovery(stillBroken, checkId, flag.attentionPolicy))
      .toEqual({ comparable: true, verdict: 'failed', observationIds: [exactFailure.id] })
    expect(verdict(stillBroken)).toBe('failed')
    const originalScope = flag.attentionPolicy!.pageScopes![0]
    const separateScopes = { ...flag.attentionPolicy,
      pageScopes: flag.attentionPolicy!.resourceKeys!.map(resourceKey => ({ ...originalScope, resourceKeys: [resourceKey] })) }
    expect(assessSearchRecovery(stillBroken, checkId, separateScopes))
      .toEqual({ comparable: true, verdict: 'failed', observationIds: [exactFailure.id] })
    const unrelatedFailure = await receipt([sitemap(replacement, state), sitemap(second, 'unavailable')])
    expect(verdict(unrelatedFailure)).toBeNull()
    const differentVersion = searchReceiptSchema.parse({ ...stillBroken, observations: stillBroken.observations.map(item =>
      item.id === exactFailure.id ? { ...item, checkVersion: 2 } : item) })
    expect(verdict(differentVersion)).toBeNull()
    const repaired = await receipt([sitemap(second, 'valid'), sitemap(first, 'valid')])
    expect(assessSearchRecovery(repaired, checkId, flag.attentionPolicy))
      .toMatchObject({ comparable: true, verdict: 'passed' })
    expect(verdict(repaired)).toBe('passed')
    const recurrence = await receipt([sitemap(second, state), sitemap(first, state)])
    expect(assessSearchRecovery(recurrence, checkId, flag.attentionPolicy)).toMatchObject({ comparable: true, verdict: 'failed' })
  })

  it('does not borrow healthy resources from another page after findings are grouped', async () => {
    const home = searchFindings((await receipt([sitemap(first, 'invalid')])).observations).find(flag => flag.checkId === 'search-sitemap-invalid')!
    const peerUrl = PAGE + 'pricing'
    const peer = searchFindings((await receipt([sitemap(second, 'invalid')], peerUrl)).observations).find(flag => flag.checkId === home.checkId)!
    const policy = mergeSearchAttentionPolicies([home.attentionPolicy, peer.attentionPolicy], home.attentionPolicy)
    expect(assessSearchRecovery(await receipt([sitemap(first, 'valid')], peerUrl), home.checkId, policy)).toMatchObject({ verdict: 'unknown' })
    expect(assessSearchRecovery(await receipt([sitemap(second, 'valid')], peerUrl), home.checkId, policy)).toMatchObject({ verdict: 'passed' })
    expect(assessSearchRecovery(await receipt([sitemap(first, 'valid')]), home.checkId, policy)).toMatchObject({ verdict: 'passed' })
  })

  it('does not reconstruct an unknown historical resource identity from a later inventory', async () => {
    const after = await receipt([sitemap(replacement, 'valid')])
    expect(assessSearchRecovery(after, 'search-sitemap-invalid', { policy: 'search', version: 1, kind: 'flag', reason: 'sitemap_invalid_xml', sources: ['sitemap'] }))
      .toMatchObject({ comparable: false, verdict: 'unknown' })
  })
})
