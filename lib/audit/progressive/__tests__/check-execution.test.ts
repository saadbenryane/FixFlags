import { describe, expect, it } from 'vitest'
import { CHECK_REGISTRY } from '../../check-registry'
import { checkReceiptSchema, recordedCheckVersion } from '../../checks/receipt'
import { admittedCheckVersions, checkExecution } from '../check-execution'

const checks = { 'flow-mobile-menu-broken': CHECK_REGISTRY['flow-mobile-menu-broken'].version,
  'flow-cta-404': CHECK_REGISTRY['flow-cta-404'].version }
const executionSpec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
  environment: 'production', checks, outcomes: [], verificationTarget: null }
const context = { audit: { id: 'source', executionSpec }, task: { id: 'native-task' } }

describe('shared check method provenance', () => {
  it('records admitted detector versions independently of the receipt wrapper version', () => {
    const execution = checkExecution(context, 'mobile-navigation', 'rendered-dom', '2026-10-21T12:00:00.000Z')
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'mobile-navigation',
      pageUrl: executionSpec.targetUrl, applicable: true, complete: true, passed: true, assertions: [], execution })
    expect(execution).toMatchObject({ auditId: 'source', taskId: 'native-task', checkVersion: 1,
      checkVersions: { 'flow-mobile-menu-broken': 2 }, collectedAt: '2026-10-21T12:00:00.000Z' })
    expect(recordedCheckVersion(receipt, 'flow-mobile-menu-broken')).toBe(2)
    expect(recordedCheckVersion(receipt, 'flow-cta-404')).toBeUndefined()
  })
  it.each([1, 3])('refuses unsupported admitted method %s without relabeling it', version => {
    const original = { ...executionSpec, checks: { 'flow-mobile-menu-broken': version } }
    expect(() => admittedCheckVersions(original, 'mobile-navigation')).toThrow('CHECK_VERSION_UNAVAILABLE')
    expect(original.checks['flow-mobile-menu-broken']).toBe(version)
  })
  it('does not add methods that were never admitted', () => {
    expect(admittedCheckVersions(executionSpec, 'overlays')).toEqual({})
    expect(admittedCheckVersions(null, 'mobile-navigation')).toEqual({})
    expect(admittedCheckVersions(executionSpec, 'flow')).toEqual({ 'flow-cta-404': checks['flow-cta-404'] })
  })
})
