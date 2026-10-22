import { describe, expect, it } from 'vitest'
import { hasRecordedRecoveryEvidence, recordedVerificationVerdict, type RecoveryExecution } from '../recovery-evidence'
import { isPageComparableAbsence } from '../diff-flags'
import { checkReceiptSchema } from '../checks/receipt'
import { evaluateSearch, searchFindings } from '../search/registry'
import { searchReceiptSchema } from '../search/contracts'
import { evidence, document, PAGE } from '../search/__tests__/fixtures'
import { RESOURCE_REPAIR_RULE, resourceAuditContext } from '../pagespeed-opportunities'
import { runSecurityHeaderChecks, securityHeaderObservations } from '../checks/security-headers'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from './check-fixtures'
import { performanceConditionContext, scopePerformanceAssertions } from '../performance-measurement'
import { runPerformanceChecks } from '../checks/performance'
import { mergeSupportingObservations, observationsForFlag } from '../flag-observations'

const url = 'https://example.com/pricing'
function spec(checkId: string) {
  return { engine: 'progressive-v1', version: 1, targetUrl: url, environment: 'production', scope: 'SITE',
    checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null }
}
function row(overrides = {}): RecoveryExecution {
  const detail = checkReceiptSchema.parse({
    kind: 'site-module-check', version: 1, module: 'performance', pageUrl: url,
    applicable: true, passed: true, complete: true,
    assertions: [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }],
    execution: { auditId: 'after', taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: new Date().toISOString() },
    ...overrides,
  })
  detail.assertions = scopePerformanceAssertions(healthyDesktopPs({ diagnostics: { measurement: pageSpeedMeasurementFixture(detail.pageUrl) } }), detail.pageUrl, detail.assertions)
  return { targetKey: 'module:performance', status: 'COMPLETED', detail }
}
const labFlag = (pageUrl = url) => runPerformanceChecks(healthyDesktopPs({ lcp: 3000,
  diagnostics: { measurement: pageSpeedMeasurementFixture(pageUrl) } }), null, pageUrl).find(flag => flag.checkId === 'lcp-poor')!
function recovered(checkId: string, executions: RecoveryExecution[], extraFlag = {}) {
  return hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec(checkId),
    flag: { checkId, pageUrl: url, ...extraFlag }, executions })
}

describe('automatic recovery uses recorded responsibility evidence', () => {
  it('cannot borrow healthy Search evidence from a different trailing-slash resource', async () => {
    const originalUrl = url + '/'
    const read = async (pageUrl: string, title: string) => {
      const page = document('<html><head>' + title + '</head><body><h1>Pricing</h1></body></html>', { url: pageUrl, finalUrl: pageUrl })
      const input = evidence(undefined, { auditId: 'after', pageUrl, original: page, rendered: page })
      return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'after', pageUrl, collectedAt: input.collectedAt,
        complete: true, observations: await evaluateSearch(input, null, ['presentation']) })
    }
    const before = await read(originalUrl, '')
    const flag = searchFindings(before.observations).find(flag => flag.checkId === 'title-missing')!
    const after = await read(url, '<title>Useful pricing</title>')
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec('title-missing'), flag,
      executions: [{ targetKey: 'module:search-presentation', status: 'COMPLETED', detail: after }] })).toBe(false)
    const exact = await read(originalUrl, '<title>Useful pricing</title>')
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec('title-missing'), flag,
      executions: [{ targetKey: 'module:search-presentation', status: 'COMPLETED', detail: exact }] })).toBe(true)
  })
  it('requires every structured original observation and its exact admitted version', () => {
    const peer = 'https://example.com/other'
    const original = (pageUrl: string) => observationsForFlag({ ...labFlag(pageUrl), pageUrl }, {
      auditId: 'before', taskId: 'source:' + pageUrl, checkVersion: 1,
    })
    const support = mergeSupportingObservations([original(url), original(peer)])
    const assess = (executions: RecoveryExecution[], supportingObservations: unknown = support) => recordedVerificationVerdict({
      auditId: 'after', executionSpec: spec('lcp-poor'), flag: { ...labFlag(), supportingObservations }, executions,
    })
    expect(assess([row()])).toBeNull()
    expect(assess([row(), row({ pageUrl: peer })])).toBe('passed')
    expect(assess([row(), row({ pageUrl: peer, assertions: [{ key: 'lcp', name: 'LCP', expected: 'Fast', observed: '6000ms', passed: false, complete: true }] })])).toBe('failed')
    expect(assess([row()], { ...support, items: [{ ...support.items[0], checkVersion: 2 }] })).toBeNull()
    expect(assess([row()], { ...support, items: [{ ...support.items[0], provenance: null }] })).toBeNull()
    expect(assess([row()], { version: 2, items: [] })).toBeNull()
  })
  it('requires every original page to pass, while an original failure disproves repair across a gap', () => {
    const peer = 'https://example.com/other'
    const assess = (executions: RecoveryExecution[]) => recordedVerificationVerdict({ auditId: 'after', executionSpec: spec('lcp-poor'),
      flag: { ...labFlag(), pageUrl: url, affectedPaths: [url, peer], evidenceTargets: [...labFlag().evidenceTargets!, ...labFlag(peer).evidenceTargets!] }, executions })
    const failed = row({ pageUrl: peer, passed: false, assertions: [{ key: 'lcp', name: 'LCP', expected: 'Fast', observed: '6000ms',
      passed: false, complete: true }] })
    expect(assess([row()])).toBeNull()
    expect(assess([row(), row({ pageUrl: peer })])).toBe('passed')
    expect(assess([row(), failed])).toBe('failed')
    expect(assess([failed])).toBe('failed')
    expect(assess([row(), { ...failed, status: 'FAILED' }])).toBeNull()
    expect(assess([row(), row({ pageUrl: peer, failed: true })])).toBeNull()
  })

  it('keeps a disappearing finding open when its evaluator did not complete, even on a completed page', () => {
    expect(isPageComparableAbsence({ auditStatus: 'COMPLETED', reportCompleteness: 'FULL',
      childPages: [{ url, status: 'COMPLETED', completeness: 'FULL' }], auditId: 'after',
      executionSpec: spec('lcp-poor'), parentFlag: { checkId: 'lcp-poor', pageUrl: url } })).toBe(false)
    expect(recovered('lcp-poor', [{ ...row(), status: 'FAILED' }])).toBe(false)
  })

  it('allows a proved lab repair despite unrelated partial Site coverage, and rejects failed or different scope', () => {
    expect(isPageComparableAbsence({ auditStatus: 'COMPLETED', reportCompleteness: 'PARTIAL',
      childPages: [], auditId: 'after', executionSpec: spec('lcp-poor'),
      parentFlag: labFlag(), verifierExecutions: [row()] })).toBe(true)
    const fragmentUrl = url + '#/plans'
    const fragmentFlag = { ...labFlag(fragmentUrl), pageUrl: fragmentUrl }
    expect(isPageComparableAbsence({ auditStatus: 'COMPLETED', reportCompleteness: 'PARTIAL',
      childPages: [], auditId: 'after', executionSpec: spec('lcp-poor'),
      parentFlag: fragmentFlag, verifierExecutions: [row()] })).toBe(false)
    expect(isPageComparableAbsence({ auditStatus: 'COMPLETED', reportCompleteness: 'PARTIAL',
      childPages: [], auditId: 'after', executionSpec: spec('lcp-poor'),
      parentFlag: fragmentFlag, verifierExecutions: [row({ pageUrl: fragmentUrl })] })).toBe(true)
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
      ...(row().detail as object), module: 'security-headers', assertions: securityHeaderObservations(url, { 'content-security-policy': "default-src 'self'" }),
      execution: { auditId: 'after', taskId: 'headers', checkVersion: 1, source: 'http', collectedAt: new Date().toISOString() },
    }) }
    const source = runSecurityHeaderChecks(url, { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
      'strict-transport-security': 'max-age=31536000; includeSubDomains; preload' }).find(flag => flag.checkId === 'security-csp-missing')!
    expect(recovered('security-csp-missing', [headers], source)).toBe(true)
    expect(recovered('security-csp-missing', [headers])).toBe(false)
    expect(recovered('security-csp-unsafe-inline', [headers])).toBe(false)
  })

  it('uses the same exact Performance responsibility proof despite unrelated unknown audits', () => {
    const context = performanceConditionContext(healthyDesktopPs({ diagnostics: { measurement: pageSpeedMeasurementFixture(url) } }), url,
      resourceAuditContext(url, 'desktop', { providerAuditId: 'unused-javascript', unit: 'bytes' }, 100_000))
    const flag = { verificationRule: RESOURCE_REPAIR_RULE,
      evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', context }] }
    const assertion = { key: 'unused-javascript', name: 'Unused JavaScript', expected: 'No excessive measured waste',
      observed: '0 bytes in the new measurement', passed: true, complete: true,
      targets: [{ selector: 'lighthouse:unused-javascript', label: 'unused-javascript', context }] }
    const partial = row({ complete: false, passed: false, assertions: [assertion] })
    expect(recovered('unused-js-large', [partial], flag)).toBe(true)
    expect(recovered('unused-js-large', [partial])).toBe(false)
    const unscopedSummary = { targetKey: 'check:unused-js-large', status: 'COMPLETED', detail: {
      kind: 'check-verifier', version: 1, auditId: 'after', taskId: 'speed', checkVersion: 1,
      checkId: 'unused-js-large', pageUrl: url, source: 'pagespeed-desktop', collectedAt: new Date().toISOString(),
      comparable: true, verdict: 'passed', assertion,
    } }
    expect(recovered('unused-js-large', [unscopedSummary])).toBe(false)
    expect(recovered('render-blocking', [partial])).toBe(false)
    expect(recovered('unused-css-large', [partial])).toBe(false)
    expect(recovered('unused-js-large', [row({ complete: false, assertions: [{ ...assertion, complete: false }] })], flag)).toBe(false)
    expect(recovered('unused-js-large', [row({ complete: false, assertions: [{ ...assertion, complete: undefined }] })], flag)).toBe(false)
    expect(recovered('unused-js-large', [row({ complete: false, assertions: [{ ...assertion, passed: false }] })], flag)).toBe(false)
  })

  it('requires conclusive matching controls instead of a healthy subset of keyboard navigation', () => {
    const assertion = { key: 'focus-styles', name: 'Focus', expected: 'Visible focus', observed: 'Style observed',
      passed: true, complete: true, targets: [{ selector: '#action', label: 'Action', context: `keyboard:${'a'.repeat(64)}:${'b'.repeat(64)}:dialog:#open=>#dialog` }] }
    const keyboard = { ...row(), targetKey: 'module:keyboard', detail: checkReceiptSchema.parse({
      ...(row().detail as object), module: 'keyboard', complete: false, passed: false,
      assertions: [assertion], execution: { auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard', collectedAt: new Date().toISOString() },
    }) }
    const flag = { verificationRule: 'Keyboard probe: inspect focus', evidenceTargets: assertion.targets }
    expect(recovered('focus-visible-missing', [keyboard], flag)).toBe(true)
    expect(recovered('focus-visible-missing', [keyboard], { ...flag, evidenceTargets: [{ selector: '#unvisited', label: 'Other' }] })).toBe(false)
    expect(recovered('focus-visible-missing', [keyboard], { ...flag, evidenceTargets: [{ ...assertion.targets[0], context: 'page' }] })).toBe(false)
    const exact = { targetKey: 'check:focus-visible-missing', status: 'COMPLETED', detail: {
      kind: 'check-verifier', version: 1, auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard',
      checkId: 'focus-visible-missing', pageUrl: url, collectedAt: new Date().toISOString(), comparable: true, verdict: 'passed', assertion,
    } }
    expect(recovered('focus-visible-missing', [keyboard, exact], flag)).toBe(true)
    expect(recovered('focus-visible-missing', [keyboard, exact], { ...flag, evidenceTargets: [{ selector: '#unvisited', label: 'Other' }] })).toBe(false)
    expect(recovered('focus-visible-missing', [exact], flag)).toBe(false)
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
