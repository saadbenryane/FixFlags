import { describe, expect, it, vi } from 'vitest'
import { assertionForTarget, recordAssertionVerifiers, scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
import { TRACKING_VERIFICATION_RULE } from '../tracking/identity'

const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security-headers',
  pageUrl: 'https://example.com/', applicable: true, passed: false,
  assertions: [{ key: 'content-security-policy', name: 'CSP', expected: 'An enforcing CSP is present', observed: 'CSP absent', passed: false }],
  execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'http', collectedAt: '2026-10-11T10:00:00.000Z' } })
const keyboardPrefix = `keyboard:${'a'.repeat(64)}:${'b'.repeat(64)}:`

describe('exact assertion verification', () => {
  it('keeps historical keyboard controls without capture conditions unverified', () => {
    const target = { selector: '#action', label: 'Action' }
    const keyboard = checkReceiptSchema.parse({ ...receipt, module: 'keyboard', complete: true, passed: true,
      assertions: [{ key: 'focus-styles', name: 'Focus', expected: 'Visible focus', observed: 'Styled', passed: true, complete: true, targets: [target] }],
      execution: { ...receipt.execution!, source: 'keyboard' } })
    expect(scopedAssertionForTarget({ receipt: keyboard, checkId: 'focus-visible-missing', flag: {
      verificationRule: 'Keyboard probe: repeat navigation', evidenceTargets: [target],
    } })).toBeUndefined()
  })
  it('does not use CSP presence to verify an unsafe CSP or module absence to verify a finding', () => {
    expect(assertionForTarget(receipt, 'security-csp-missing')?.passed).toBe(false)
    expect(assertionForTarget(receipt, 'security-csp-unsafe-inline')).toBeUndefined()
    expect(assertionForTarget({ ...receipt, assertions: [] }, 'security-csp-missing')).toBeUndefined()
    expect(assertionForTarget({ ...receipt, assertions: [{ ...receipt.assertions[0], complete: false }] }, 'security-csp-missing')).toBeUndefined()
  })
  it('cannot verify a signed-in finding with another page or public context', () => {
    const account = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'automatic-accounts', pageUrl: 'https://example.com/dashboard',
      applicable: true, passed: true, complete: true,
      assertions: [{ key: 'signed-in-page', name: 'Signed-in page', expected: 'Page works', observed: 'Page opened', passed: true, complete: true,
        context: 'account:signed_in:v1:https://example.com/dashboard' }],
      execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: '2026-10-12T10:00:00.000Z' } })
    const original = { verificationRule: 'Automatic account observation v1', evidenceTargets: [{ context: 'account:signed_in:v1:https://example.com/billing' }] }
    expect(scopedAssertionForTarget({ receipt: account, checkId: 'account-signed-in-page', flag: original })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: account, checkId: 'account-signed-in-page', flag: { ...original,
      evidenceTargets: [{ context: 'account:signed_in:v1:https://example.com/dashboard' }] } })?.assertion.passed).toBe(true)
  })
  it('records failed assertions without claiming recovery and ignores another page', async () => {
    const upsert = vi.fn()
    const flag = { source: 'DETERMINISTIC', fingerprint: null, checkId: 'security-csp-missing', pageUrl: receipt.pageUrl }
    const tx = { improvementAttempt: { findMany: vi.fn().mockResolvedValue([
      { improvement: { occurrences: [{ flag }, { flag: { ...flag, pageUrl: 'https://example.com/private' } }] } },
    ]) }, auditVerifierExecution: { upsert, findMany: vi.fn().mockResolvedValue([]) } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt }, tx as never)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][0]).toMatchObject({ update: {}, create: {
      status: 'COMPLETED', detail: { verdict: 'failed', comparable: true, taskId: 'task', assertion: { passed: false } },
      evidenceReference: { source: 'http', collectedAt: receipt.execution!.collectedAt },
    } })
  })
  it('certifies a keyboard repair only for the same observed controls in complete evidence', async () => {
    const target = { selector: '#action', label: 'Action', context: keyboardPrefix + 'page_load' }
    const keyboard = checkReceiptSchema.parse({ ...receipt, module: 'keyboard', complete: true, passed: true,
      assertions: [{ key: 'focus-styles', name: 'Focus styles', expected: 'Observable focus style', observed: 'Style observed', passed: true, targets: [target] }],
      execution: { ...receipt.execution!, source: 'keyboard' } })
    const upsert = vi.fn()
    const flag = { source: 'DETERMINISTIC', fingerprint: null, checkId: 'focus-visible-missing', pageUrl: keyboard.pageUrl,
      verificationRule: 'Keyboard probe: repeat navigation', evidenceTargets: [target] }
    const tx = { improvementAttempt: { findMany: vi.fn().mockResolvedValue([
      { improvement: { occurrences: [{ flag }, { flag: { ...flag, evidenceTargets: [{ selector: '#unvisited', label: 'Unvisited' }] } },
        { flag: { ...flag, evidenceTargets: [{ selector: '#action', label: 'Different action' }] } },
        { flag: { ...flag, verificationRule: 'Historical Lighthouse result' } }] } },
    ]) }, auditVerifierExecution: { upsert, findMany: vi.fn().mockResolvedValue([]) } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: keyboard }, tx as never)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][0].create.detail).toMatchObject({ verdict: 'passed', source: 'keyboard', assertion: { targets: [target] } })
    upsert.mockClear()
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: { ...keyboard, complete: false } }, tx as never)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('verifies an observed popup scope independently and never uses closed-page or unknown evidence', async () => {
    const context = keyboardPrefix + 'menu:#options=>#menu'
    const target = { selector: '#action', label: 'Action', context }
    const flag = { source: 'DETERMINISTIC', fingerprint: null, checkId: 'focus-visible-missing', pageUrl: receipt.pageUrl,
      verificationRule: 'Keyboard probe: repeat navigation', evidenceTargets: [target] }
    const assertion = { key: 'focus-styles', name: 'Focus styles', expected: 'Observable style', observed: 'Style observed',
      passed: true, complete: true, context, targets: [target] }
    const keyboard = checkReceiptSchema.parse({ ...receipt, module: 'keyboard', complete: false, passed: false,
      assertions: [assertion], execution: { ...receipt.execution!, source: 'keyboard' } })
    const upsert = vi.fn()
    const tx = { improvementAttempt: { findMany: vi.fn().mockResolvedValue([{ improvement: { occurrences: [{ flag }] } }]) },
      auditVerifierExecution: { upsert, findMany: vi.fn().mockResolvedValue([]) } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: keyboard }, tx as never)
    expect(upsert).toHaveBeenCalledTimes(1)
    upsert.mockClear()
    for (const observation of [
      { ...assertion, targets: [{ selector: '#action', label: 'Action' }] },
      { ...assertion, targets: [{ ...target, context: 'menu:#different=>#menu' }] },
      { ...assertion, passed: false, complete: false },
      { ...assertion, disposition: 'observed' as const },
    ]) {
      await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true,
        receipt: { ...keyboard, assertions: [observation] } }, tx as never)
    }
    expect(upsert).not.toHaveBeenCalled()
  })
  it('requires every original keyboard page from the same execution and check version', () => {
    const targets = ['a', 'c'].map(page => ({ selector: '#action', label: 'Action',
      context: `keyboard:${page.repeat(64)}:${'b'.repeat(64)}:page_load` }))
    const observed = targets.map((target, index) => checkReceiptSchema.parse({ ...receipt, module: 'keyboard', complete: true, passed: true,
      pageUrl: `https://example.com/${index}`, assertions: [{ key: 'focus-styles', name: 'Focus', expected: 'Visible focus', observed: 'Styled',
        passed: true, complete: true, targets: [target] }], execution: { ...receipt.execution!, source: 'keyboard', taskId: 'keyboard-' + index } }))
    const compare = (sources: typeof observed) => scopedAssertionForTarget({ receipt: observed[0], receipts: sources,
      checkId: 'focus-visible-missing', flag: { verificationRule: 'Keyboard probe: repeat navigation', evidenceTargets: targets } })
    expect(compare([observed[0]])).toBeUndefined()
    expect(compare(observed)?.assertion.passed).toBe(true)
    expect(compare(observed)?.supportingTasks.map(task => task.taskId)).toEqual(['keyboard-0', 'keyboard-1'])
    for (const execution of [{ ...observed[1].execution!, auditId: 'other' }, { ...observed[1].execution!, checkVersion: 2 },
      { ...observed[1].execution!, source: 'rendered-dom' as const }]) expect(compare([observed[0], { ...observed[1], execution }])).toBeUndefined()
  })
  it('retains a comparable keyboard failure while another original control is unavailable', () => {
    const targets = ['a', 'c'].map(page => ({ selector: '#action', label: 'Action',
      context: `keyboard:${page.repeat(64)}:${'b'.repeat(64)}:page_load` }))
    const observed = checkReceiptSchema.parse({ ...receipt, module: 'keyboard', complete: false, passed: false,
      assertions: [{ key: 'focus-styles', name: 'Focus', expected: 'Visible focus', observed: 'The original action has no focus style',
        passed: false, complete: true, targets: [targets[0]] }], execution: { ...receipt.execution!, source: 'keyboard' } })
    const flag = { verificationRule: 'Keyboard probe: repeat navigation', evidenceTargets: targets }
    const compare = (passed: boolean) => scopedAssertionForTarget({ receipt: { ...observed,
      assertions: observed.assertions.map(assertion => ({ ...assertion, passed })) }, checkId: 'focus-visible-missing', flag })
    expect(compare(false)).toMatchObject({ assertion: { passed: false, complete: true, targets: [targets[0]],
      observed: expect.stringContaining('1 of 2 original comparisons remain unavailable.') },
      supportingTasks: [{ taskId: 'task', pageUrl: observed.pageUrl, collectedAt: observed.execution!.collectedAt }] })
    expect(compare(true)).toBeUndefined()
    for (const assertion of [
      { ...observed.assertions[0], complete: false },
      { ...observed.assertions[0], disposition: 'observed' as const },
      { ...observed.assertions[0], targets: [{ ...targets[0], label: 'Another action' }] },
    ]) expect(scopedAssertionForTarget({ receipt: { ...observed, assertions: [assertion] }, checkId: 'focus-visible-missing', flag })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: { ...observed, failed: true }, checkId: 'focus-visible-missing', flag })).toBeUndefined()
    const crowded = scopedAssertionForTarget({ receipt: { ...observed, assertions: [
      { ...observed.assertions[0], passed: true, observed: 'A passing control. '.repeat(110).slice(0, 2000), targets: [targets[1]] },
      observed.assertions[0],
    ] }, checkId: 'focus-visible-missing', flag: { ...flag, evidenceTargets: [targets[1], targets[0],
      { ...targets[0], selector: '#unavailable' }] } })
    expect(crowded?.assertion.observed).toMatch(/^The original action has no focus style/)
    expect(crowded?.assertion.observed).toHaveLength(2000)
    expect(crowded?.assertion.observed).toMatch(/1 of 3 original comparisons remain unavailable\.$/)
  })

  it('requires the original Tracking endpoint and phase, retaining unknown for suppressed or unobserved scopes', async () => {
    const context = 'tracking:page_load:google-analytics:library:www.googletagmanager.com/gtag/js:request:v2:' + 'a'.repeat(64) + ':capture:' + 'b'.repeat(64) + ':page:' + 'c'.repeat(64)
    const assertion = { key: 'tracking-library', name: 'Library transfer', expected: 'Resource completes', observed: 'HTTP 200, transfer completed', passed: true, complete: true, context }
    const measurement = checkReceiptSchema.parse({ ...receipt, module: 'measurement', complete: true, passed: true,
      assertions: [assertion], execution: { ...receipt.execution!, source: 'browser-network' } })
    const flag = { source: 'DETERMINISTIC', fingerprint: null, checkId: 'tracking-library-http-error', pageUrl: receipt.pageUrl,
      verificationRule: TRACKING_VERIFICATION_RULE, evidenceTargets: [{ kind: 'page', context }] }
    const upsert = vi.fn()
    const tx = { improvementAttempt: { findMany: vi.fn().mockResolvedValue([{ improvement: { occurrences: [{ flag }] } }]) }, auditVerifierExecution: { upsert, findMany: vi.fn().mockResolvedValue([]) } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: measurement }, tx as never)
    expect(upsert).toHaveBeenCalledOnce()
    upsert.mockClear()
    tx.improvementAttempt.findMany.mockResolvedValue([{ improvement: { occurrences: [{ flag: {
      ...flag, verificationRule: 'Tracking observation: repeat the same endpoint',
    } }] } }])
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: measurement }, tx as never)
    expect(upsert).not.toHaveBeenCalled()
    tx.improvementAttempt.findMany.mockResolvedValue([{ improvement: { occurrences: [{ flag }] } }])
    for (const observation of [
      { ...assertion, context: context.replace('page_load', 'public_action') },
      { ...assertion, context: context.replace('google-analytics', 'plausible') },
      { ...assertion, context: context.replace('/gtag/js', '/analytics.js') },
      { ...assertion, context: context.replace(':request:v2:', ':request:legacy:') },
      { ...assertion, complete: false, passed: false },
      { ...assertion, disposition: 'observed' as const },
      { key: 'analytics-markup', name: 'Markup', expected: 'Snippet present', observed: 'Present', passed: true },
    ]) await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: { ...measurement, assertions: [observation] } }, tx as never)
    expect(upsert).not.toHaveBeenCalled()
    tx.improvementAttempt.findMany.mockResolvedValue([{ improvement: { occurrences: [{ flag: { ...flag, evidenceTargets: [{ kind: 'page', context }, { kind: 'page', context: 'unobserved' }] } }] } }])
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: measurement }, tx as never)
    expect(upsert).not.toHaveBeenCalled()
  })

})
