import { describe, expect, it } from 'vitest'
import { hasRecordedRecoveryEvidence, type RecoveryExecution } from '../recovery-evidence'
import { isPageComparableAbsence } from '../diff-flags'
import { checkReceiptSchema } from '../checks/receipt'
import { evaluateSearch, searchFindings } from '../search/registry'
import { searchReceiptSchema } from '../search/contracts'
import { evidence, document, PAGE } from '../search/__tests__/fixtures'

const url = 'https://example.com/pricing'
function spec(checkId: string) {
  return { engine: 'progressive-v1', version: 1, targetUrl: url, environment: 'production', scope: 'SITE',
    checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null }
}
function row(overrides = {}): RecoveryExecution {
  return { targetKey: 'module:performance', status: 'COMPLETED', detail: checkReceiptSchema.parse({
    kind: 'site-module-check', version: 1, module: 'performance', pageUrl: url,
    applicable: true, passed: true, complete: true,
    assertions: [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true }],
    execution: { auditId: 'after', taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: new Date().toISOString() },
    ...overrides,
  }) }
}
function recovered(checkId: string, executions: RecoveryExecution[], extraFlag = {}) {
  return hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec(checkId),
    flag: { checkId, pageUrl: url, ...extraFlag }, executions })
}

describe('automatic recovery uses recorded responsibility evidence', () => {
  it('keeps a disappearing finding open when its evaluator did not complete, even on a completed page', () => {
    expect(isPageComparableAbsence({ auditStatus: 'COMPLETED', reportCompleteness: 'FULL',
      childPages: [{ url, status: 'COMPLETED', completeness: 'FULL' }], auditId: 'after',
      executionSpec: spec('lcp-poor'), parentFlag: { checkId: 'lcp-poor', pageUrl: url } })).toBe(false)
    expect(recovered('lcp-poor', [{ ...row(), status: 'FAILED' }])).toBe(false)
  })

  it('allows a proved lab repair despite unrelated partial Site coverage, and rejects failed or different scope', () => {
    expect(isPageComparableAbsence({ auditStatus: 'COMPLETED', reportCompleteness: 'PARTIAL',
      childPages: [], auditId: 'after', executionSpec: spec('lcp-poor'),
      parentFlag: { checkId: 'lcp-poor', pageUrl: url + '/#section' }, verifierExecutions: [row()] })).toBe(true)
    for (const receipt of [row({ complete: false }), row({ applicable: false }), row({ failed: true }),
      row({ pageUrl: 'https://example.com/other' }), row({ assertions: [] }),
      row({ assertions: [{ key: 'lcp', name: 'LCP', expected: 'Fast', observed: '6000ms', passed: false }] }),
      row({ execution: { auditId: 'before', taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: new Date().toISOString() } }),
    ]) expect(recovered('lcp-poor', [receipt])).toBe(false)
    expect(recovered('lcp-poor', [row()], { affectedPaths: [url, 'https://example.com/other'] })).toBe(false)
  })

  it('cannot convert module success, header presence or a rolling field window into a stricter repair', () => {
    expect(recovered('render-blocking', [row()])).toBe(false)
    expect(recovered('inp-poor', [row()])).toBe(false)
    const headers = { ...row(), targetKey: 'module:security-headers', detail: checkReceiptSchema.parse({
      ...(row().detail as object), module: 'security-headers', assertions: [{ key: 'content-security-policy',
        name: 'CSP', expected: 'Present', observed: 'Present', passed: true }],
      execution: { auditId: 'after', taskId: 'headers', checkVersion: 1, source: 'http', collectedAt: new Date().toISOString() },
    }) }
    expect(recovered('security-csp-missing', [headers])).toBe(true)
    expect(recovered('security-csp-unsafe-inline', [headers])).toBe(false)
  })

  it('uses the same exact Performance responsibility proof despite unrelated unknown audits', () => {
    const assertion = { key: 'unused-javascript', name: 'Unused JavaScript', expected: 'No excessive measured waste',
      observed: '0 bytes in the new measurement', passed: true, complete: true }
    const partial = row({ complete: false, passed: false, assertions: [assertion] })
    expect(recovered('unused-js-large', [partial])).toBe(true)
    expect(recovered('render-blocking', [partial])).toBe(false)
    expect(recovered('unused-css-large', [partial])).toBe(false)
    expect(recovered('unused-js-large', [row({ complete: false, assertions: [{ ...assertion, complete: false }] })])).toBe(false)
    expect(recovered('unused-js-large', [row({ complete: false, assertions: [{ ...assertion, complete: undefined }] })])).toBe(false)
    expect(recovered('unused-js-large', [row({ complete: false, assertions: [{ ...assertion, passed: false }] })])).toBe(false)
  })

  it('requires conclusive matching controls instead of a healthy subset of keyboard navigation', () => {
    const assertion = { key: 'focus-styles', name: 'Focus', expected: 'Visible focus', observed: 'Style observed',
      passed: true, complete: true, targets: [{ selector: '#action', label: 'Action', context: 'dialog:#open=>#dialog' }] }
    const keyboard = { ...row(), targetKey: 'module:keyboard', detail: checkReceiptSchema.parse({
      ...(row().detail as object), module: 'keyboard', complete: false, passed: false,
      assertions: [assertion], execution: { auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard', collectedAt: new Date().toISOString() },
    }) }
    const flag = { verificationRule: 'Keyboard probe: inspect focus', evidenceTargets: assertion.targets }
    expect(recovered('focus-visible-missing', [keyboard], flag)).toBe(true)
    expect(recovered('focus-visible-missing', [keyboard], { ...flag, evidenceTargets: [{ selector: '#unvisited', label: 'Other' }] })).toBe(false)
    expect(recovered('focus-visible-missing', [keyboard], { ...flag, evidenceTargets: [{ ...assertion.targets[0], context: 'page' }] })).toBe(false)
  })

  it('shares Search source comparability with explicit fix verification', async () => {
    const beforeInput = evidence('<html><head></head><body>Page</body></html>')
    const before = await evaluateSearch(beforeInput)
    const flag = searchFindings(before).find(item => item.checkId === 'title-missing')!
    const input = evidence(undefined, { rendered: document(null) })
    const partial = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'after',
      pageUrl: PAGE, collectedAt: input.collectedAt, complete: false, observations: await evaluateSearch(input) })
    const target = { auditId: 'after', executionSpec: { ...spec('title-missing'), targetUrl: PAGE },
      flag: { ...flag, pageUrl: PAGE }, executions: [{ targetKey: 'module:search-presentation', status: 'COMPLETED', detail: partial }] }
    expect(hasRecordedRecoveryEvidence(target)).toBe(false)
    const healthyInput = evidence()
    const repaired = { ...partial, complete: true, observations: await evaluateSearch(healthyInput) }
    expect(hasRecordedRecoveryEvidence({ ...target, executions: [{ ...target.executions[0], detail: repaired }] })).toBe(true)
  })
})
