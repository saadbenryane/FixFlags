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
})
