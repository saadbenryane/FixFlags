import { describe, expect, it } from 'vitest'
import { resolveAuditAdmission, type AuditAdmission } from '../admission'

const spec = { version: 1 as const, engine: 'progressive-v1' as const, targetUrl: 'https://example.com/',
  environment: 'production', scope: 'SITE' as const, checks: {}, outcomes: [], verificationTarget: null }
const request = { id: 'run', projectId: 'site', requestedByUserId: 'owner', source: 'WEB' as const, idempotencyKey: 'intent' }

describe('explicit audit admission policy', () => {
  it('meters first checks and permits reuse only within the existing creation fence', () => {
    expect(resolveAuditAdmission({ kind: 'new-check' })).toMatchObject({ skipUsageCount: false, retryParent: false, reuseActiveManual: true })
  })
  it('binds retries to the original check and includes their scan allowance', () => {
    expect(resolveAuditAdmission({ kind: 'retry', parentId: 'before' })).toMatchObject({ parentId: 'before', retryParent: true, skipUsageCount: true })
  })
  it.each(['SITE', 'CATEGORY', 'OUTCOMES', 'DIAGNOSTIC', 'FIXTURE_SETUP', 'ACCOUNT_CHECKS'] as const)('derives Site-run policy from its admitted %s scope', scope => {
    const admitted = resolveAuditAdmission({ kind: 'site-run', request, executionSpec: { ...spec, scope } })
    expect(admitted.skipUsageCount).toBe(!['SITE', 'CATEGORY'].includes(scope))
    expect(admitted.reuseActiveManual).toBe(false)
    expect(admitted.runRequestId).toBe(request.id)
  })
  it('includes scheduled monitoring without allowing a separate charging switch', () => {
    expect(resolveAuditAdmission({ kind: 'site-run', request: { ...request, source: 'WATCH' }, executionSpec: spec }))
      .toMatchObject({ skipUsageCount: true, recheckTrigger: 'WATCH' })
  })
  it.each([undefined, {}, { kind: 'retry' }, { kind: 'update', parentId: 'before' }, { kind: 'site-run', request: {} }])('refuses incomplete internal intent: %j', admission => {
    expect(() => resolveAuditAdmission(admission as AuditAdmission)).toThrow()
  })
})
