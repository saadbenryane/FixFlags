import { describe, expect, it } from 'vitest'
import { runSecurityHeaderChecks, securityHeaderObservations } from './security-headers'
import { checkReceiptSchema } from './receipt'
import { scopedAssertionForTarget } from './verification'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { CHECK_REGISTRY } from '../check-registry'
import { runAllChecks } from './index'
import { parseMetadataFromHtml } from '../metadata'

const pageUrl = 'https://example.com/'
const healthy = {
  'content-security-policy': "default-src 'self'; script-src 'self'; object-src 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin', 'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-permitted-cross-domain-policies': 'none',
}
function receipt(headers: Record<string, string> | null, responseUrl = pageUrl) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security-headers',
    pageUrl, applicable: headers !== null, passed: false, assertions: securityHeaderObservations(responseUrl, headers),
    execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'http', collectedAt: '2026-10-12T12:00:00.000Z' } })
}
function proof(flag: ReturnType<typeof runSecurityHeaderChecks>[number], headers: Record<string, string> | null, responseUrl = pageUrl) {
  return scopedAssertionForTarget({ receipt: receipt(headers, responseUrl), checkId: flag.checkId, flag })?.assertion
}

describe('public response header repair evidence', () => {
  const cases = [
    ['security-csp-missing', 'content-security-policy', null],
    ['security-csp-unsafe-inline', 'content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'"],
    ['security-csp-unsafe-eval', 'content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-eval'; object-src 'none'"],
    ['security-csp-weak-object-src', 'content-security-policy', "default-src 'self'; object-src *"],
    ['security-hsts-missing', 'strict-transport-security', null],
    ['security-hsts-too-short', 'strict-transport-security', 'max-age=60; includeSubDomains; preload'],
    ['security-hsts-no-subdomains', 'strict-transport-security', 'max-age=31536000; preload'],
    ['security-hsts-no-preload', 'strict-transport-security', 'max-age=31536000; includeSubDomains'],
    ['security-frame-options-missing', 'x-frame-options', null],
    ['security-frame-options-too-permissive', 'x-frame-options', 'ALLOWALL'],
    ['security-content-type-options-missing', 'x-content-type-options', null],
    ['security-referrer-policy-missing', 'referrer-policy', null],
    ['security-referrer-policy-weak', 'referrer-policy', 'unsafe-url'],
    ['security-coop-missing', 'cross-origin-opener-policy', null],
    ['security-coep-missing', 'cross-origin-embedder-policy', null],
    ['security-corp-missing', 'cross-origin-resource-policy', null],
    ['security-permissions-policy-missing', 'permissions-policy', null],
    ['security-permissions-policy-overbroad', 'permissions-policy', 'camera=*'],
    ['security-x-permitted-cross-domain', 'x-permitted-cross-domain-policies', 'all'],
  ] as const
  it.each(cases)('proves %s from the same inspected responsibility', (checkId, header, value) => {
    const broken: Record<string, string> = { ...healthy }
    if (value === null) delete broken[header]; else broken[header] = value
    const flag = runSecurityHeaderChecks(pageUrl, broken).find(item => item.checkId === checkId)!
    expect(flag).toBeDefined()
    expect(proof(flag, broken)).toMatchObject({ passed: false, complete: true })
    expect(proof(flag, healthy)).toMatchObject({ passed: true, complete: true })
    expect(proof(flag, healthy, 'https://example.com/other')).toBeUndefined()
    expect(proof(flag, null)).toBeUndefined()
  })
  it('requires enforcement rather than a report-only replacement', () => {
    const { 'content-security-policy': csp, ...rest } = healthy
    const broken = { ...rest, 'content-security-policy-report-only': csp }
    const flag = runSecurityHeaderChecks(pageUrl, broken).find(item => item.checkId === 'security-csp-report-only')!
    expect(proof(flag, broken)?.passed).toBe(false)
    expect(proof(flag, healthy)?.passed).toBe(true)
  })
  it('verifies every originally failed core responsibility, even after the rollup disappears', () => {
    const flag = runSecurityHeaderChecks(pageUrl, {})[0]
    expect(flag.checkId).toBe('security-headers-missing')
    expect(flag.evidenceTargets).toHaveLength(4)
    const partial = { ...healthy, 'strict-transport-security': '' }
    expect(runSecurityHeaderChecks(pageUrl, partial).some(item => item.checkId === flag.checkId)).toBe(false)
    expect(proof(flag, partial)?.passed).toBe(false)
    // An unrelated hardening gap does not invalidate the recorded core repair.
    expect(proof(flag, { ...healthy, 'referrer-policy': '' })?.passed).toBe(true)
    expect(proof(flag, healthy, 'https://other.example.com/')).toBeUndefined()
    expect(proof({ ...flag, evidenceTargets: undefined, verificationRule: undefined }, healthy)).toBeUndefined()
  })
  it('verifies exactly the original hardening scope and keeps absent CSP script scope unknown', () => {
    const broken = { ...healthy, 'referrer-policy': '', 'cross-origin-opener-policy': '', 'permissions-policy': '' }
    const flag = runSecurityHeaderChecks(pageUrl, broken)[0]
    expect(flag.checkId).toBe('security-headers-hardening')
    expect(proof(flag, broken)?.passed).toBe(false)
    expect(proof(flag, { ...healthy, 'cross-origin-resource-policy': '' })?.passed).toBe(true)
    const inline = runSecurityHeaderChecks(pageUrl, { ...healthy, 'content-security-policy': "script-src 'unsafe-inline'; object-src 'none'" })[0]
    expect(proof(inline, { ...healthy, 'content-security-policy': '' })).toBeUndefined()
  })
  it('keeps unparseable HSTS and a downgraded response inconclusive', () => {
    const flag = runSecurityHeaderChecks(pageUrl, { ...healthy, 'strict-transport-security': 'max-age=60; includeSubDomains; preload' })[0]
    for (const duration of ['unparseable', 'max-age=' + '9'.repeat(400), 'max-age=31536000invalid',
      'bogus-max-age=31536000', 'max-age=31536000; max-age=60'])
      expect(proof(flag, { ...healthy, 'strict-transport-security': duration })).toBeUndefined()
    expect(proof(flag, healthy, 'http://example.com/')).toBeUndefined()
  })
  it('shares the exact positive proof between automatic recovery and explicit verification', () => {
    const flag = { ...runSecurityHeaderChecks(pageUrl, {})[0], pageUrl }
    const input = { auditId: 'after', flag, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
      environment: 'production', scope: 'SITE', outcomes: [], verificationTarget: null, checks: { [flag.checkId]: CHECK_REGISTRY[flag.checkId].version } } }
    const executions = (headers: Record<string, string>) => [{ targetKey: 'module:security-headers', status: 'COMPLETED', detail: receipt(headers) }]
    expect(hasRecordedRecoveryEvidence({ ...input, executions: executions(healthy) })).toBe(true)
    expect(hasRecordedRecoveryEvidence({ ...input, executions: executions({ ...healthy, 'x-content-type-options': '' }) })).toBe(false)
  })
  it('publishes unparseable declarations as incomplete evidence through the shared page evaluator', async () => {
    const headers = { ...healthy, 'strict-transport-security': 'max-age=31536000invalid; includeSubDomains; preload' }
    const result = await runAllChecks(pageUrl, parseMetadataFromHtml('<h1>Header fixture</h1>', pageUrl), null, null, [],
      undefined, undefined, headers, undefined, true, ['security-headers'])
    expect(result.flags).toEqual([])
    expect(result.executions[0]).toMatchObject({ passed: false, complete: false, applicable: true,
      assertions: expect.arrayContaining([{ ...securityHeaderObservations(pageUrl, headers).find(item => item.key === 'hsts-duration') }]) })
  })
})
