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

it.each(['https://example.up.railway.app/', 'https://example.netlify.app/', 'https://example.vercel.app/'])(
  'keeps missing response headers separate from unobserved hosting permissions on %s', url => {
    const headers = { ...healthy, 'content-security-policy': '' }
    const flag = runSecurityHeaderChecks(url, headers).find(item => item.checkId === 'security-headers-missing')!
    expect(flag.problem).toBe('1 core security header is missing or weak')
    expect(flag.evidence).toContain('No Content-Security-Policy header')
    expect(flag.evidence).toContain('Hosting configuration was not inspected')
    expect(flag.evidence).not.toMatch(/not settable|requires custom domain/i)
    expect(flag.fix).toContain('Content-Security-Policy')
    expect(flag.fix).not.toMatch(/cannot be set|connect a custom domain/i)
    expect(runSecurityHeaderChecks(url, healthy)).toEqual([])
  },
)
function receipt(headers: Record<string, string> | null, responseUrl = pageUrl) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security-headers',
    pageUrl, applicable: headers !== null, passed: false, assertions: securityHeaderObservations(responseUrl, headers),
    execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'http', collectedAt: '2026-10-12T12:00:00.000Z' } })
}
function proof(flag: ReturnType<typeof runSecurityHeaderChecks>[number], headers: Record<string, string> | null, responseUrl = pageUrl) {
  return scopedAssertionForTarget({ receipt: receipt(headers, responseUrl), checkId: flag.checkId, flag })?.assertion
}

describe('public response header repair evidence', () => {
  it.each([
    ['security-coop-missing', 'cross-origin-opener-policy', 'same-origin', 'unsafe-none'],
    ['security-coep-missing', 'cross-origin-embedder-policy', 'require-corp', 'unsafe-none'],
    ['security-corp-missing', 'cross-origin-resource-policy', 'same-origin', 'cross-origin'],
  ])('cannot verify %s from an ignored cross-origin declaration', (checkId, header, token, permissive) => {
    const flag = runSecurityHeaderChecks(pageUrl, { ...healthy, [header]: '' }).find(flag => flag.checkId === checkId)!
    expect(flag).toBeDefined()
    for (const value of ['unrecognized-policy', '"' + token + '"', token.toUpperCase(), token + ', ' + token])
      expect(proof(flag, { ...healthy, [header]: value })).toBeUndefined()
    const configured = { ...healthy, [header]: permissive }
    expect(securityHeaderObservations(pageUrl, configured).find(item => item.key === (header === 'cross-origin-opener-policy' ? 'opener-policy' : header === 'cross-origin-embedder-policy' ? 'embedder-policy' : 'resource-policy')))
      .toMatchObject({ complete: true, passed: true, disposition: 'observed', observed: expect.stringContaining(permissive) })
    expect(runSecurityHeaderChecks(pageUrl, configured).map(flag => flag.checkId)).not.toContain(checkId)
    expect(proof(flag, configured)).toBeUndefined()
    expect(proof(flag, healthy)).toMatchObject({ complete: true, passed: true })
    const old = { ...flag, evidenceTargets: flag.evidenceTargets!.map(target => ({ ...target, context: target.context!.replace('security-header:v2:', 'security-header:') })) }
    expect(proof(old, healthy)).toBeUndefined()
    const executionSpec = { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
      checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null }
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec, flag: { ...old, pageUrl },
      executions: [{ targetKey: 'module:security-headers', status: 'COMPLETED', detail: receipt(healthy) }] })).toBe(false)
  })
  it.each([
    ['camera=(*)', false], ['microphone=(*)', false], ['geolocation=(self *)', false],
    ['camera=*, camera=()', true], ['camera=(), camera=*', false],
    ['reporting="camera=*", not-microphone=*', true], ['camera=(self "https://trusted.test")', true],
    ['camera=*;report-to=default', false], ['camera = *', undefined], ['CAMERA=*', undefined],
    ['camera=*, broken=(', undefined], ['camera=*, unknown=@123', undefined], ['camera=*, unknown=%"example"', undefined],
  ])('interprets sensitive permission wildcard tokens: %s', (value, passed) => {
    const headers = { ...healthy, 'permissions-policy': value as string }
    expect(securityHeaderObservations(pageUrl, headers).find(item => item.key === 'permissions-policy'))
      .toMatchObject({ passed: passed === true, complete: passed !== undefined })
    expect(runSecurityHeaderChecks(pageUrl, headers).some(flag => flag.checkId === 'security-permissions-policy-overbroad')).toBe(passed === false)
  })
  it.each([
    { value: 'max-age=31536000; ignored-includeSubDomains; no-preload', complete: true, duration: true, subdomains: false, preload: false },
    { value: 'max-age=31536000; note="includeSubDomains; preload"', complete: true, duration: true, subdomains: false, preload: false },
    { value: 'max-age="31536000"; includeSubDomains; preload', complete: true, duration: true, subdomains: true, preload: true },
    { value: 'max-age=31536000invalid; includeSubDomains; preload', complete: false, duration: false, subdomains: false, preload: false },
    { value: 'max-age=31536000; includeSubDomains; includeSubDomains; preload', complete: false, duration: false, subdomains: false, preload: false },
    { value: 'max-age=0; includeSubDomains; preload', complete: true, duration: false, subdomains: false, preload: false },
    { value: 'max-age=31536000; includeSubDomains; preload=unrecognized', complete: true, duration: true, subdomains: true, preload: false },
    { value: '  MAX-AGE = "31536000" ; INCLUDESUBDOMAINS ; PRELOAD ; extension="value;with\\\"quotes" ; ', complete: true, duration: true, subdomains: true, preload: true },
    { value: 'max-age=31536000; includeSubDomains=ignored; preload', complete: false, duration: false, subdomains: false, preload: false },
    { value: 'max-age=31536000; includeSubDomains; preload; unknown="unterminated', complete: false, duration: false, subdomains: false, preload: false },
  ])('interprets one complete HSTS declaration: $value', scenario => {
    const assertions = securityHeaderObservations(pageUrl, { ...healthy, 'strict-transport-security': scenario.value })
    for (const [key, passed] of [['duration', scenario.duration], ['subdomains', scenario.subdomains], ['preload', scenario.preload]] as const)
      expect(assertions.find(item => item.key === 'hsts-' + key)).toMatchObject({ complete: scenario.complete, passed })
  })
  it.each([
    ['security-hsts-too-short', 'max-age=60; includeSubDomains; preload'],
    ['security-hsts-no-subdomains', 'max-age=31536000; other-includeSubDomains; preload'],
    ['security-hsts-no-preload', 'max-age=31536000; includeSubDomains; other-preload'],
  ])('verifies the original valid HSTS responsibility for %s', (checkId, value) => {
    const flag = runSecurityHeaderChecks(pageUrl, { ...healthy, 'strict-transport-security': value }).find(flag => flag.checkId === checkId)!
    expect(flag).toBeDefined()
    expect(proof(flag, { ...healthy, 'strict-transport-security': value })).toMatchObject({ complete: true, passed: false })
    for (const header of ['max-age=31536000invalid; includeSubDomains; preload', 'includeSubDomains; preload',
      'max-age=31536000; max-age=60; includeSubDomains; preload'])
      expect(proof(flag, { ...healthy, 'strict-transport-security': header })).toBeUndefined()
    expect(proof(flag, { ...healthy, 'strict-transport-security': 'max-age="31536000"; includeSubDomains; preload' }))
      .toMatchObject({ complete: true, passed: true })
    const old = { ...flag, evidenceTargets: flag.evidenceTargets!.map(target => ({ ...target,
      context: target.context!.replace('security-header:v2:', 'security-header:') })) }
    expect(proof(old, healthy)).toBeUndefined()
    const executionSpec = { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
      checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null }
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec, flag: { ...old, pageUrl },
      executions: [{ targetKey: 'module:security-headers', status: 'COMPLETED', detail: receipt(healthy) }] })).toBe(false)
  })
  it.each([
    ['nosniff', true], ['NoSnIfF', true], ['nosniff, other', true], ['\t nosniff \t', true],
    ['other, nosniff', false], ['nosniff-disabled', false], ['"nosniff"', false], ['\u00a0nosniff', false],
  ])('interprets the first MIME protection field value: %s', (value, passed) => {
    const headers = { ...healthy, 'x-content-type-options': value as string }
    expect(securityHeaderObservations(pageUrl, headers).find(item => item.key === 'x-content-type-options'))
      .toMatchObject({ passed, complete: true })
    expect(runSecurityHeaderChecks(pageUrl, headers).some(flag => flag.checkId === 'security-content-type-options-missing')).toBe(!passed)
  })
  it.each([
    ['unsafe-url, strict-origin-when-cross-origin', true], ['no-referrer, no-referrer-when-downgrade', false],
    ['origin, unsafe-url', false], ['no-referrer, unrecognized', true],
    ['"unsafe-url", origin', true], ['unsafe-url, "no-referrer"', false],
    ['unrecognized', undefined], ['UNSAFE-URL', false], ['"unknown, no-referrer, unknown"', undefined],
  ])('interprets the last recognized referrer response policy: %s', (value, passed) => {
    const headers = { ...healthy, 'referrer-policy': value as string }
    expect(securityHeaderObservations(pageUrl, headers).find(item => item.key === 'referrer-policy'))
      .toMatchObject({ passed: passed === true, complete: passed !== undefined })
    expect(runSecurityHeaderChecks(pageUrl, headers).some(flag => flag.checkId === 'security-referrer-policy-weak')).toBe(passed === false)
  })
  it.each([
    ['security-content-type-options-missing', 'x-content-type-options', 'other, nosniff'],
    ['security-referrer-policy-weak', 'referrer-policy', 'no-referrer, no-referrer-when-downgrade'],
    ['security-permissions-policy-overbroad', 'permissions-policy', 'camera=(*)'],
  ])('retains the corrected policy scope for %s repairs', (checkId, header, value) => {
    const broken = { ...healthy, [header]: value }
    const flag = runSecurityHeaderChecks(pageUrl, broken).find(item => item.checkId === checkId)!
    expect(proof(flag, broken)).toMatchObject({ passed: false, complete: true })
    expect(proof(flag, healthy)).toMatchObject({ passed: true, complete: true })
    const old = { ...flag, evidenceTargets: flag.evidenceTargets!.map(target => ({ ...target,
      context: target.context!.replace('security-header:v2:', 'security-header:') })) }
    expect(proof(old, healthy)).toBeUndefined()
    const oldReceipt = receipt(broken)
    oldReceipt.assertions = oldReceipt.assertions.map(item => ({ ...item, context: item.context?.replace('security-header:v2:', 'security-header:') }))
    expect(scopedAssertionForTarget({ receipt: oldReceipt, checkId, flag: old })).toBeUndefined()
    const executionSpec = { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
      checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null }
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec, flag: { ...old, pageUrl },
      executions: [{ targetKey: 'module:security-headers', status: 'COMPLETED', detail: receipt(healthy) }] })).toBe(false)
    if (header === 'referrer-policy') expect(proof(flag, { ...healthy, [header]: 'unrecognized' })).toBeUndefined()
    if (header === 'permissions-policy') expect(proof(flag, { ...healthy, [header]: 'camera = *' })).toBeUndefined()
  })
  const cases = [
    ['security-csp-missing', 'content-security-policy', null],
    ['security-csp-unsafe-inline', 'content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'"],
    ['security-csp-unsafe-eval', 'content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-eval'; object-src 'none'"],
    ['security-csp-frame-ancestors-permissive', 'content-security-policy', "default-src 'self'; object-src 'none'; frame-ancestors *"],
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
  it('does not certify old CSP detector scopes or legacy summaries as customer repairs', () => {
    const flag = runSecurityHeaderChecks(pageUrl, { ...healthy, 'content-security-policy': "script-src 'self' 'unsafe-eval'; object-src 'none'" })[0]
    const legacy = { ...flag, pageUrl, evidenceTargets: flag.evidenceTargets!.map(target => ({ ...target,
      context: target.context!.replace('security-header:v2:', 'security-header:') })) }
    expect(proof(legacy, healthy)).toBeUndefined()
    const oldReceipt = receipt(healthy)
    oldReceipt.assertions = oldReceipt.assertions.map(item => ({ ...item, context: item.context?.replace('security-header:v2:', 'security-header:') }))
    expect(scopedAssertionForTarget({ receipt: oldReceipt, checkId: flag.checkId, flag: legacy })).toBeUndefined()
    const executionSpec = { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
      outcomes: [], verificationTarget: null, checks: { [flag.checkId]: 1 } }
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec, flag: legacy,
      executions: [{ targetKey: 'module:security-headers', status: 'COMPLETED', detail: receipt(healthy) }] })).toBe(false)
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec, flag: { ...legacy, evidenceTargets: undefined, verificationRule: undefined },
      executions: [{ targetKey: 'check:' + flag.checkId, status: 'COMPLETED', detail: { kind: 'check-verifier', version: 1,
        auditId: 'after', taskId: 'task', checkId: flag.checkId, checkVersion: 1, pageUrl, source: 'http', collectedAt: '2026-10-12T12:00:00.000Z',
        comparable: true, verdict: 'passed', assertion: receipt(healthy).assertions.find(item => item.key === 'csp-eval') } }] })).toBe(false)
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
  it('retains a known original header failure when another original header is unknown', () => {
    const flag = runSecurityHeaderChecks(pageUrl, {})[0]
    const partial = { ...healthy, 'strict-transport-security': 'max-age=31536000invalid', 'x-content-type-options': '' }
    expect(proof(flag, partial)).toMatchObject({ passed: false, complete: true })
    expect(proof(flag, { ...partial, 'x-content-type-options': 'nosniff' })).toBeUndefined()
    expect(proof(flag, healthy)).toMatchObject({ passed: true, complete: true })
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
