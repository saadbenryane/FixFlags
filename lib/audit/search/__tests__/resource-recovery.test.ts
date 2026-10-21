import { describe, expect, it } from 'vitest'
import { evaluateSearch, searchFindings } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { mergeSearchAttentionPolicies } from '../attention-scope'
import { searchReceiptSchema, type PublicDocument } from '../contracts'
import { document, evidence, PAGE } from './fixtures'
import { hasRecordedRecoveryEvidence } from '../../recovery-evidence'

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
    const recovered = (current: Awaited<ReturnType<typeof receipt>>) => hasRecordedRecoveryEvidence({
      auditId: current.auditId, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: PAGE,
        environment: 'production', checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null }, flag,
      executions: [{ targetKey: 'module:search-discovery', status: 'COMPLETED', detail: current }],
    })
    for (const documents of [
      [sitemap(replacement, 'valid')], [sitemap(first, 'valid')],
      [sitemap(first, 'valid'), sitemap(second, 'unavailable')],
      [sitemap(first + '?version=changed', 'valid'), sitemap(second, 'valid')],
    ]) {
      const current = await receipt(documents)
      expect(assessSearchRecovery(current, checkId, flag.attentionPolicy)).toMatchObject({ comparable: false, verdict: 'unknown' })
      expect(recovered(current)).toBe(false)
    }
    const repaired = await receipt([sitemap(second, 'valid'), sitemap(first, 'valid')])
    expect(assessSearchRecovery(repaired, checkId, flag.attentionPolicy))
      .toMatchObject({ comparable: true, verdict: 'passed' })
    expect(recovered(repaired)).toBe(true)
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
