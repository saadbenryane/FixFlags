import { describe, expect, it } from 'vitest'
import { runAllChecks } from '@/lib/audit/checks'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { buildCoverageFacts, evidencedAreasFromCoverage } from '../coverage'

const url = 'https://example.test/'
const now = new Date('2026-10-14T02:00:00Z')
async function observe(html: string) {
  const checked = await runAllChecks(url, parseMetadataFromHtml(html, url), null, null, [], undefined, undefined, undefined,
    undefined, true, ['security'])
  return { targetKey: 'module:security', status: 'COMPLETED', pageUrl: url, detail: {
    kind: 'site-module-check', version: 1, ...checked.executions[0], pageUrl: url } }
}
function fact(receipts: Array<{ targetKey: string; status: string; detail: unknown }>) {
  return buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: {}, flags: [], verifierExecutions: receipts })
    .find(fact => fact.area === 'security')!
}
describe('Site Security coverage from recorded transport evidence', () => {
  it('recognizes the real current evaluator without requiring media, providers or the old image assertion', async () => {
    const observed = await observe('<main><h1>Useful service</h1><img src="/hero.png"><script src="/app.js"></script></main>')
    expect(observed.detail.assertions?.map(assertion => assertion.key)).toContain('resource-transport')
    expect(observed.detail.assertions?.map(assertion => assertion.key)).not.toContain('image-transport')
    expect(fact([observed])).toMatchObject({ state: 'healthy', evidenced: true, checkedAt: now.toISOString() })
  })
  it('preserves an older explicit image observation without allowing it to override current resource evidence', async () => {
    const observed = await observe('<main><h1>Useful service</h1></main>')
    const historical = { ...observed, detail: { ...observed.detail, assertions: observed.detail.assertions!.map(assertion =>
      assertion.key === 'resource-transport' ? { ...assertion, key: 'image-transport' } : assertion) } }
    expect(fact([historical])).toMatchObject({ state: 'healthy', evidenced: true })
    const currentFailure = { ...historical, detail: { ...historical.detail, assertions: [...historical.detail.assertions,
      { key: 'resource-transport', name: 'Resources', expected: 'Trustworthy transport', observed: 'HTTP script', passed: false, complete: true }] } }
    expect(evidencedAreasFromCoverage({}, [], [currentFailure]).has('security')).toBe(false)
  })
  it('refuses missing, failed, incomplete and advisory transport receipts', async () => {
    const observed = await observe('<main><h1>Useful service</h1></main>')
    const assertions = observed.detail.assertions!
    for (const variant of [{ ...observed, status: 'FAILED' }, { ...observed, detail: { ...observed.detail, failed: true } },
      { ...observed, detail: { ...observed.detail, applicable: false } },
      ...[{ complete: false }, { disposition: 'observed' as const }].map(change => ({ ...observed, detail: { ...observed.detail,
        assertions: assertions.map(assertion => assertion.key === 'resource-transport' ? { ...assertion, ...change } : assertion) } }))]) {
      expect(evidencedAreasFromCoverage({}, [], [variant]).has('security')).toBe(false)
      expect(fact([variant]).state).toBe('unknown')
    }
    expect(fact([]).state).toBe('unknown')
  })
  it.each(['OPEN', 'UNCHANGED', 'REGRESSED', 'UNVERIFIED'])('retains an active %s Flag despite passing evidence', async status => {
    const observed = await observe('<main><h1>Useful service</h1></main>')
    const facts = buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: {}, verifierExecutions: [observed],
      flags: [{ checkId: 'no-https', rubric: 'REACH', impactTag: 'TRUST', severity: 'CRITICAL', status }] })
    expect(facts.find(fact => fact.area === 'security')).toMatchObject({ state: 'problem', openFlagCount: 1 })
  })
  it('excludes resolved severity and findings from current attention counts', async () => {
    const observed = await observe('<main><h1>Useful service</h1></main>')
    const facts = buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: {}, verifierExecutions: [observed], flags: [
      { checkId: 'no-privacy-policy', rubric: 'REACH', impactTag: 'TRUST', severity: 'POLISH', status: 'OPEN' },
      { checkId: 'no-https', rubric: 'REACH', impactTag: 'TRUST', severity: 'CRITICAL', status: 'FIXED' },
      { checkId: 'security-mixed-content', rubric: 'REACH', impactTag: 'TRUST', severity: 'CRITICAL', status: 'IGNORED' },
    ] })
    expect(facts.find(fact => fact.area === 'security')).toMatchObject({ state: 'attention', openFlagCount: 1 })
  })
})
