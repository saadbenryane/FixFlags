import { describe, expect, it, vi } from 'vitest'
import { checkReceiptSchema, recordedCheckVersion } from './receipt'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { evaluatorHandlers } from '../progressive/evaluators'
import type { TaskContext } from '../progressive/registry'
import { observationsForFlag } from '../flag-observations'
import { recordAssertionVerifiers } from './verification'

const pageUrl = 'https://example.com/'
const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'trust', pageUrl, passed: true, applicable: true,
  assertions: [{ key: 'privacy-link', name: 'Privacy policy link', expected: 'Published privacy link', observed: 'Published privacy link found', passed: true, complete: true },
    { key: 'cookie-consent-signals', name: 'Consent signals', expected: 'Published consent control', observed: 'Published consent control found', passed: true, complete: true }],
  execution: { auditId: 'after', taskId: 'trust-task', checkVersion: 2, checkVersions: { 'no-privacy-policy': 1, 'cookie-consent-absent': 2 },
    source: 'rendered-dom', collectedAt: '2026-10-17T02:00:00.000Z' } })
const recover = (checkId: string, version: number, detail: unknown = receipt) => hasRecordedRecoveryEvidence({ auditId: 'after',
  executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: { [checkId]: version }, outcomes: [], verificationTarget: null },
  flag: { checkId, pageUrl }, executions: [{ targetKey: 'module:trust', status: 'COMPLETED', detail }] })

describe('recorded individual check versions', () => {
  it('keeps module and individual policy versions separate in recovery', () => {
    expect(recordedCheckVersion(receipt, 'no-privacy-policy')).toBe(1)
    expect(recordedCheckVersion(receipt, 'cookie-consent-absent')).toBe(2)
    expect(recover('no-privacy-policy', 1)).toBe(true)
    expect(recover('cookie-consent-absent', 2)).toBe(true)
    expect(recover('cookie-consent-absent', 1)).toBe(false)
    expect(recover('cookie-consent-absent', 2, { ...receipt, execution: { ...receipt.execution!, checkVersions: { 'cookie-consent-absent': 1 } } })).toBe(false)
  })
  it('never substitutes the module version for an identity omitted from an explicit map', () => {
    const absent = { ...receipt, execution: { ...receipt.execution!, checkVersions: {} } }
    expect(recordedCheckVersion(absent, 'cookie-consent-absent')).toBeUndefined()
    expect(recover('cookie-consent-absent', 2, absent)).toBe(false)
  })
  it('retains the recorded legacy version without inventing an identity map', () => {
    const { checkVersions: omitted, ...execution } = receipt.execution!
    void omitted
    const legacy = checkReceiptSchema.parse({ ...receipt, execution: { ...execution, checkVersion: 1 } })
    expect(legacy.execution?.checkVersions).toBeUndefined()
    expect(recordedCheckVersion(legacy, 'no-privacy-policy')).toBe(1)
    expect(recover('no-privacy-policy', 1, legacy)).toBe(true)
    expect(recover('cookie-consent-absent', 2, legacy)).toBe(false)
    expect(recover('cookie-consent-absent', 1, legacy)).toBe(true)
  })
  it('preserves an old concluded repair without letting a new method clear the original obligation', () => {
    const original = observationsForFlag({ checkId: 'cookie-consent-absent', source: 'DETERMINISTIC', pageUrl, evidence: 'Original consent control absence',
      rubric: 'REACH', severity: 'POLISH', problem: 'Original problem', fix: 'Original guidance', confidence: 0.7 }, { auditId: 'before', taskId: 'original-task', checkVersion: 1 })
    const assess = (version: number, detail: unknown) => hasRecordedRecoveryEvidence({ auditId: 'after',
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: { 'cookie-consent-absent': version }, outcomes: [], verificationTarget: null },
      flag: { checkId: 'cookie-consent-absent', pageUrl, supportingObservations: original }, executions: [{ targetKey: 'module:trust', status: 'COMPLETED', detail }] })
    const old = { ...receipt, execution: { ...receipt.execution!, checkVersion: 1, checkVersions: { 'cookie-consent-absent': 1 } } }
    expect(assess(1, old)).toBe(true)
    expect(assess(2, receipt)).toBe(false)
    const future = { ...receipt, execution: { ...receipt.execution!, checkVersion: 3, checkVersions: { 'cookie-consent-absent': 3 } } }
    expect(recover('cookie-consent-absent', 3, future)).toBe(false)
  })
  it.each([{ 'lcp-poor': 1 }, { unknown: 1 }, { 'no-privacy-policy': 0 }])('rejects invalid or cross-module identities: %j', checkVersions => {
    expect(checkReceiptSchema.safeParse({ ...receipt, execution: { ...receipt.execution!, checkVersions } }).success).toBe(false)
  })
  it('rejects obsolete admitted versions before a new canonical collection or verdict', async () => {
    const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
    const context = { audit: { id: 'new-run', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
      environment: 'production', scope: 'SITE', checks: { 'cookie-consent-absent': 1 }, outcomes: [], verificationTarget: null } },
      input: { module: 'trust' } } as unknown as TaskContext
    await expect(evaluate(context)).rejects.toThrow('CHECK_VERSION_UNAVAILABLE')
  })
  it('persists each verifier with the actual admitted identity version and leaves omissions unresolved', async () => {
    const flags = ['no-privacy-policy', 'cookie-consent-absent'].map(checkId => ({ checkId, source: 'DETERMINISTIC', fingerprint: null, pageUrl, verificationRule: null, evidenceTargets: null }))
    const upsert = vi.fn()
    const tx = {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  improvementAttempt: { findMany: vi.fn().mockResolvedValue(flags.map(flag => ({ improvement: { occurrences: [{ flag }] } }))) }, auditVerifierExecution: { upsert } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt }, tx as never)
    expect(upsert.mock.calls.map(([value]) => ({ checkId: value.create.checkId, version: value.create.detail.checkVersion }))).toEqual([
      { checkId: 'no-privacy-policy', version: 1 }, { checkId: 'cookie-consent-absent', version: 2 },
    ])
    expect(upsert.mock.calls.every(([value]) => value.create.detail.checkVersions === undefined)).toBe(true)
    upsert.mockClear()
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: { ...receipt, execution: { ...receipt.execution!, checkVersions: {} } } }, tx as never)
    expect(upsert).not.toHaveBeenCalled()
  })
})
