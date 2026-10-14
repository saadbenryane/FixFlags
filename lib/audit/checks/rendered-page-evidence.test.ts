import { describe, expect, it, vi } from 'vitest'
import { runAllChecks } from './index'
import { parseMetadataFromHtml } from '../metadata'
import { scopeRenderedPageEvidence, RENDERED_PAGE_VERIFICATION_RULE } from './rendered-page-evidence'
import { scopedAssertionForTarget, recordAssertionVerifiers } from './verification'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { checkReceiptSchema } from './receipt'

const url = 'https://example.test/'
const scope = { pageUrl: url, finalUrl: url, profile: 'native-desktop', access: 'public' }
async function inspect(source: string, captured = scope) {
  const result = await runAllChecks(url, parseMetadataFromHtml(source, url), null, null, [], undefined, undefined, undefined,
    undefined, true, ['trust'], { renderedScope: captured })
  const execution = result.executions[0]
  return { flags: result.flags, receipt: checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, ...execution, pageUrl: url,
    execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: '2026-10-14T02:00:00.000Z' } }) }
}
describe('native page observation comparison', () => {
  it('shares comparable repair and recurrence proof while refusing different capture conditions and old unscoped history', async () => {
    const before = await inspect('<main><h1>Useful service</h1></main>')
    const flag = { ...before.flags.find(flag => flag.checkId === 'no-privacy-policy')!, pageUrl: url }
    expect(flag.verificationRule).toBe(RENDERED_PAGE_VERIFICATION_RULE)
    const checkId = 'no-privacy-policy'
    const spec = { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'SITE', checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null }
    const upsert = vi.fn()
    const tx = { improvementAttempt: { findMany: vi.fn().mockResolvedValue([{ improvement: { occurrences: [{ flag }] } }]) }, auditVerifierExecution: { upsert, findMany: vi.fn().mockResolvedValue([]) } }
    for (const [captured, comparable] of [[scope, true], [{ ...scope, access: 'credentialed:other' }, false],
      [{ ...scope, profile: 'different-viewport' }, false], [{ ...scope, finalUrl: url + 'login' }, false], [{ ...scope, access: 'credentialed:unknown' }, false]] as const) {
      const after = await inspect('<main><h1>Useful service</h1><a href="/privacy">Privacy policy</a></main>', captured)
      expect(scopedAssertionForTarget({ receipt: after.receipt, checkId, flag })?.assertion.passed).toBe(comparable ? true : undefined)
      expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec, flag,
        executions: [{ targetKey: 'module:trust', status: 'COMPLETED', detail: after.receipt }] })).toBe(comparable)
      upsert.mockClear()
      await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: after.receipt }, tx as never)
      expect(upsert.mock.calls.length).toBe(comparable ? 1 : 0)
    }
    expect(scopedAssertionForTarget({ receipt: before.receipt, checkId, flag })?.assertion.passed).toBe(false)
    expect(scopedAssertionForTarget({ receipt: before.receipt, checkId, flag: {} })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: before.receipt, checkId, flag: { verificationRule: 'Confirm the privacy link on this page' } })).toBeUndefined()
  })
  it('retains detection with missing native conditions and requires both captures for mobile layout comparisons', () => {
    const flag = { checkId: 'mobile-input-zoom', rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Small input font', evidence: '12px font', fix: 'Use 16px', confidence: 1, source: 'DETERMINISTIC' }
    const assertion = { key: 'mobile-input-fonts', name: 'Input fonts', expected: '16px or more', observed: '12px', passed: false, complete: true }
    const before = scopeRenderedPageEvidence({ module: 'mobile-ux-quality', flags: [flag], assertions: [assertion], desktop: scope,
      mobile: { ...scope, profile: 'native-mobile' } })
    expect(before.flags[0].problem).toBe(flag.problem)
    for (const changed of [{ desktop: scope }, { desktop: scope, mobile: { ...scope, profile: 'other-mobile' } }]) {
      const after = scopeRenderedPageEvidence({ module: 'mobile-ux-quality', flags: [], assertions: [{ ...assertion, passed: true }], ...changed })
      expect(after.assertions[0].context).not.toBe(before.assertions[0].context)
    }
    const unavailable = scopeRenderedPageEvidence({ module: 'trust', flags: [flag], assertions: [assertion] })
    expect(unavailable.flags[0].evidenceTargets?.[0].context).toBe('rendered-page:unknown')
    expect(unavailable.assertions[0].complete).toBe(false)
  })
  it('requires all original pages from the same execution when a finding has several affected paths', async () => {
    const first = await inspect('<main><h1>Useful service</h1></main>')
    const peerUrl = url + 'about'
    const peer = await inspect('<main><h1>Useful service</h1></main>', { ...scope, pageUrl: peerUrl, finalUrl: peerUrl })
    const original = { ...first.flags.find(flag => flag.checkId === 'no-privacy-policy')!, pageUrl: url, affectedPaths: [url, peerUrl],
      evidenceTargets: [...first.flags[0].evidenceTargets!, ...peer.flags[0].evidenceTargets!] }
    const healthy = '<main><h1>Useful service</h1><a href="/privacy">Privacy policy</a></main>'
    const after = await inspect(healthy)
    const other = await inspect(healthy, { ...scope, pageUrl: peerUrl, finalUrl: peerUrl })
    other.receipt = { ...other.receipt, pageUrl: peerUrl, execution: { ...other.receipt.execution!, taskId: 'peer-task' } }
    const compare = (receipts: typeof after.receipt[]) => scopedAssertionForTarget({ receipt: after.receipt, receipts,
      checkId: 'no-privacy-policy', flag: original })
    expect(compare([])).toBeUndefined()
    expect(compare([other.receipt])?.assertion.passed).toBe(true)
    expect(compare([{ ...other.receipt, execution: { ...other.receipt.execution!, auditId: 'unrelated' } }])).toBeUndefined()
    expect(compare([{ ...other.receipt, execution: { ...other.receipt.execution!, checkVersion: 2 } }])).toBeUndefined()
    const spec = { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'SITE', checks: { 'no-privacy-policy': 1 }, outcomes: [], verificationTarget: null }
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec, flag: original,
      executions: [after.receipt, other.receipt].map(detail => ({ targetKey: 'module:trust', status: 'COMPLETED', detail })) })).toBe(true)
  })
})
