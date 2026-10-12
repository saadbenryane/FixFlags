import { describe, expect, it, vi } from 'vitest'
import { consoleObservations, runConsoleChecks } from './console'
import { checkReceiptSchema } from './receipt'
import { scopedAssertionForTarget } from './verification'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { consoleCoverageSchema, consoleObservationMinimum, type ConsoleCoverage } from '../console-evidence'
import { captureAccessKey } from '../browser/observation-scope'

const pageUrl = 'https://example.com/'
const errors = Array.from({ length: 3 }, (_, index) => ({ type: 'error', text: 'Failure ' + index }))
function coverage(overrides: Partial<ConsoleCoverage> = {}): ConsoleCoverage {
  return { phase: 'page_load', pageUrl, access: 'public',
    desktop: { complete: true, finalUrl: pageUrl, profile: 'desktop-profile', errors: 0, observedMs: 4000, minimumMs: 2000 },
    mobile: { complete: true, finalUrl: pageUrl, profile: 'mobile-profile', errors: 0, observedMs: 4000, minimumMs: 2000 }, ...overrides }
}
function receipt(value: ConsoleCoverage, taskId = 'task') {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'console', pageUrl: value.pageUrl,
    applicable: true, passed: value.desktop.errors + value.mobile.errors === 0,
    complete: value.desktop.complete && value.mobile.complete, assertions: consoleObservations(value),
    execution: { auditId: 'after', taskId, checkVersion: 1, source: 'browser-console', collectedAt: '2026-10-12T12:00:00.000Z' } })
}
const broken = coverage({ desktop: { ...coverage().desktop, errors: 3, minimumMs: 3000 } })
const flag = runConsoleChecks(errors, broken)[0]
const proof = (value: ConsoleCoverage, original = flag) => scopedAssertionForTarget({ receipt: receipt(value), checkId: original.checkId, flag: original })?.assertion

describe('comparable console recovery', () => {
  it('compares actual access conditions with a keyed digest, excluding private presentation labels', () => {
    try {
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'fixture-only-comparison-key')
      const access = { httpBasic: { username: 'fixture-user', password: 'fixture-password' }, label: 'Original note' }
      const key = captureAccessKey(access)
      expect(key).toMatch(/^credentialed:[a-f0-9]{64}$/)
      expect(key).not.toContain('fixture-user'); expect(key).not.toContain('fixture-password')
      expect(captureAccessKey({ ...access, label: 'Updated note' })).toBe(key)
      expect(captureAccessKey({ ...access, httpBasic: { ...access.httpBasic, password: 'different-fixture-password' } })).not.toBe(key)
      expect(captureAccessKey({ label: 'No credentials' })).toBe('public')
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', undefined)
      expect(captureAccessKey(access)).toBe('credentialed:unknown')
    } finally { vi.unstubAllEnvs() }
  })
  it('preserves detector thresholds, copy and the existing Inspector noise exception', () => {
    expect(runConsoleChecks(errors, broken)[0]).toMatchObject({ checkId: 'console-errors-critical', severity: 'IMPORTANT', problem: '3 JavaScript console errors detected' })
    expect(runConsoleChecks(errors.slice(0, 1))[0]).toMatchObject({ checkId: 'console-errors-some', severity: 'POLISH', problem: '1 JavaScript console error detected' })
    expect(runConsoleChecks([{ type: 'error', text: 'net::ERR_BLOCKED_BY_CLIENT.Inspector' }, { type: 'warn', text: 'warning' }])).toEqual([])
    expect(runConsoleChecks(errors, { ...broken, messagesTruncated: true })[0].problem).toBe('At least 3 JavaScript console errors detected')
    expect(consoleObservationMinimum(flag.evidenceTargets)).toBe(3000)
  })
  it('requires both originally observed windows through the original failure horizon', () => {
    expect(proof(coverage())).toMatchObject({ passed: true, complete: true })
    expect(proof(coverage({ desktop: { ...coverage().desktop, observedMs: 2999 } }))).toBeUndefined()
    expect(proof(coverage({ mobile: { ...coverage().mobile, complete: false } }))).toBeUndefined()
    expect(proof(coverage({ desktop: { ...coverage().desktop, complete: false } }))).toBeUndefined()
    expect(proof(coverage({ phase: 'page_load_and_public_action' }))).toBeUndefined()
  })
  it('reports a positively observed remaining error even when another window is unavailable or short', () => {
    expect(proof(coverage({ desktop: { ...coverage().desktop, errors: 1, observedMs: 10 }, mobile: { ...coverage().mobile, complete: false } })))
      .toMatchObject({ passed: false, complete: true })
    // Dropping below the critical detector threshold cannot certify repair.
    expect(runConsoleChecks(errors.slice(0, 1), broken)[0].checkId).toBe('console-errors-some')
    expect(proof(coverage({ mobile: { ...coverage().mobile, errors: 1 } }))?.passed).toBe(false)
  })
  it.each([
    coverage({ pageUrl: pageUrl + 'other' }),
    coverage({ access: 'credentialed:different' }),
    coverage({ desktop: { ...coverage().desktop, finalUrl: pageUrl + 'redirect' } }),
    coverage({ desktop: { ...coverage().desktop, finalUrl: pageUrl + '#different-route' } }),
    coverage({ desktop: { ...coverage().desktop, finalUrl: 'http://example.com/' } }),
    coverage({ mobile: { ...coverage().mobile, profile: 'changed-profile' } }),
    coverage({ access: 'credentialed:unknown' }),
  ])('keeps different URLs, capture profiles and access conditions inconclusive', value => {
    expect(proof(value)).toBeUndefined()
  })
  it('keeps legacy and mixed action findings inconclusive instead of inferring repair from absence', () => {
    expect(proof(coverage(), { ...flag, evidenceTargets: undefined, verificationRule: undefined })).toBeUndefined()
    expect(runConsoleChecks(errors, coverage({ phase: 'page_load_and_public_action' }))[0].evidenceTargets).toBeUndefined()
    expect(consoleCoverageSchema.safeParse({ ...coverage(), desktop: { complete: true, finalUrl: pageUrl, errors: 0, profile: 'old' } }).success).toBe(false)
  })
  it('requires every affected page for recovery while a failure on any original page disproves it', () => {
    const other = coverage({ pageUrl: pageUrl + 'other', desktop: { ...coverage().desktop, finalUrl: pageUrl + 'other' },
      mobile: { ...coverage().mobile, finalUrl: pageUrl + 'other' } })
    const aggregate = { ...flag, evidenceTargets: [...flag.evidenceTargets!, ...runConsoleChecks(errors, other)[0].evidenceTargets!] }
    const result = (support: ReturnType<typeof receipt>[]) => scopedAssertionForTarget({ receipt: receipt(coverage()), checkId: flag.checkId, flag: aggregate, receipts: support })
    expect(result([])).toBeUndefined()
    expect(result([receipt(other, 'other-task')])?.assertion.passed).toBe(true)
    expect(result([receipt({ ...other, mobile: { ...other.mobile, errors: 1 } }, 'other-task')])?.assertion.passed).toBe(false)
    expect(result([{ ...receipt(other), execution: { ...receipt(other).execution!, auditId: 'unrelated-audit' } }])).toBeUndefined()
  })
  it('uses the same scoped proof for automatic recovery and an explicit fix verification', () => {
    const input = { auditId: 'after', flag: { ...flag, pageUrl }, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
      environment: 'production', scope: 'SITE', checks: { [flag.checkId]: 1 }, outcomes: [], verificationTarget: null } }
    expect(hasRecordedRecoveryEvidence({ ...input, executions: [{ targetKey: 'module:console', status: 'COMPLETED', detail: receipt(coverage()) }] })).toBe(true)
    expect(hasRecordedRecoveryEvidence({ ...input, executions: [{ targetKey: 'module:console', status: 'COMPLETED', detail: receipt(broken) }] })).toBe(false)
  })
})
