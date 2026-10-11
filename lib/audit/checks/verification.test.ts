import { describe, expect, it, vi } from 'vitest'
import { assertionForTarget, recordAssertionVerifiers } from './verification'
import { checkReceiptSchema } from './receipt'

const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security-headers',
  pageUrl: 'https://example.com/', applicable: true, passed: false,
  assertions: [{ key: 'content-security-policy', name: 'CSP', expected: 'An enforcing CSP is present', observed: 'CSP absent', passed: false }],
  execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'http', collectedAt: '2026-10-11T10:00:00.000Z' } })

describe('exact assertion verification', () => {
  it('does not use CSP presence to verify an unsafe CSP or module absence to verify a finding', () => {
    expect(assertionForTarget(receipt, 'security-csp-missing')?.passed).toBe(false)
    expect(assertionForTarget(receipt, 'security-csp-unsafe-inline')).toBeUndefined()
    expect(assertionForTarget({ ...receipt, assertions: [] }, 'security-csp-missing')).toBeUndefined()
    expect(assertionForTarget({ ...receipt, assertions: [{ ...receipt.assertions[0], complete: false }] }, 'security-csp-missing')).toBeUndefined()
  })
  it('records failed assertions without claiming recovery and ignores another page', async () => {
    const upsert = vi.fn()
    const flag = { source: 'DETERMINISTIC', fingerprint: null, checkId: 'security-csp-missing', pageUrl: receipt.pageUrl }
    const tx = { improvementAttempt: { findMany: vi.fn().mockResolvedValue([
      { improvement: { occurrences: [{ flag }, { flag: { ...flag, pageUrl: 'https://example.com/private' } }] } },
    ]) }, auditVerifierExecution: { upsert } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt }, tx as never)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][0]).toMatchObject({ update: {}, create: {
      status: 'COMPLETED', detail: { verdict: 'failed', comparable: true, taskId: 'task', assertion: { passed: false } },
      evidenceReference: { source: 'http', collectedAt: receipt.execution!.collectedAt },
    } })
  })
  it('certifies a keyboard repair only for the same observed controls in complete evidence', async () => {
    const keyboard = checkReceiptSchema.parse({ ...receipt, module: 'keyboard', complete: true, passed: true,
      assertions: [{ key: 'focus-styles', name: 'Focus styles', expected: 'Observable focus style', observed: 'Style observed', passed: true, targets: [{ selector: '#action', label: 'Action' }] }],
      execution: { ...receipt.execution!, source: 'keyboard' } })
    const upsert = vi.fn()
    const flag = { source: 'DETERMINISTIC', fingerprint: null, checkId: 'focus-visible-missing', pageUrl: keyboard.pageUrl,
      verificationRule: 'Keyboard probe: repeat navigation', evidenceTargets: [{ selector: '#action', label: 'Action' }] }
    const tx = { improvementAttempt: { findMany: vi.fn().mockResolvedValue([
      { improvement: { occurrences: [{ flag }, { flag: { ...flag, evidenceTargets: [{ selector: '#unvisited', label: 'Unvisited' }] } },
        { flag: { ...flag, evidenceTargets: [{ selector: '#action', label: 'Different action' }] } },
        { flag: { ...flag, verificationRule: 'Historical Lighthouse result' } }] } },
    ]) }, auditVerifierExecution: { upsert } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: keyboard }, tx as never)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][0].create.detail).toMatchObject({ verdict: 'passed', source: 'keyboard', assertion: { targets: [{ selector: '#action', label: 'Action' }] } })
    upsert.mockClear()
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: { ...keyboard, complete: false } }, tx as never)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('verifies an observed popup scope independently and never uses closed-page or unknown evidence', async () => {
    const context = 'menu:#options=>#menu'
    const target = { selector: '#action', label: 'Action', context }
    const flag = { source: 'DETERMINISTIC', fingerprint: null, checkId: 'focus-visible-missing', pageUrl: receipt.pageUrl,
      verificationRule: 'Keyboard probe: repeat navigation', evidenceTargets: [target] }
    const assertion = { key: 'focus-styles', name: 'Focus styles', expected: 'Observable style', observed: 'Style observed',
      passed: true, complete: true, context, targets: [target] }
    const keyboard = checkReceiptSchema.parse({ ...receipt, module: 'keyboard', complete: false, passed: false,
      assertions: [assertion], execution: { ...receipt.execution!, source: 'keyboard' } })
    const upsert = vi.fn()
    const tx = { improvementAttempt: { findMany: vi.fn().mockResolvedValue([{ improvement: { occurrences: [{ flag }] } }]) },
      auditVerifierExecution: { upsert } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: keyboard }, tx as never)
    expect(upsert).toHaveBeenCalledTimes(1)
    upsert.mockClear()
    for (const observation of [
      { ...assertion, targets: [{ selector: '#action', label: 'Action' }] },
      { ...assertion, targets: [{ ...target, context: 'menu:#different=>#menu' }] },
      { ...assertion, passed: false, complete: false },
    ]) {
      await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true,
        receipt: { ...keyboard, assertions: [observation] } }, tx as never)
    }
    expect(upsert).not.toHaveBeenCalled()
  })

})
