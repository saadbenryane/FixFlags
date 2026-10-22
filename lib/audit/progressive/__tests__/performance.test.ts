import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { evaluatorHandlers } from '../evaluators'
import { readArtifact, serializeArtifact } from '../contracts'
import { checkArtifactSchema } from '../results'
import { assertionForTarget, scopedAssertionForTarget } from '../../checks/verification'
import { publishUnfinishedCoverage } from '../incomplete'
import type { TaskContext } from '../registry'
import type { PageSpeedResult } from '../../pagespeed'
import { readResourceAudits, projectResourceOpportunities } from '../../pagespeed-opportunities'
import { hasRecordedRecoveryEvidence } from '../../recovery-evidence'
import { CHECK_REGISTRY } from '../../check-registry'
import { readTapTargetAudits } from '../../pagespeed-tap-targets'
import { performanceMeasurement } from '../../performance-measurement'

const pageUrl = 'https://example.com/pricing'
const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
function measurement(overrides: Partial<PageSpeedResult> = {}): PageSpeedResult {
  const strategy = overrides.strategy ?? 'mobile'
  return { strategy, score: 95, lcp: 1000, cls: 0, fcp: 500, tbt: 0, inp: null,
    tapTargetAudits: readTapTargetAudits({ 'target-size': { score: 1 } }),
    opportunities: [], resourceAudits: readResourceAudits({
      'render-blocking-insight': { score: 1, metricSavings: { FCP: 0 } },
      'unused-javascript': { score: 1, details: { overallSavingsBytes: 0 } },
      'unused-css-rules': { score: 1, details: { overallSavingsBytes: 0 } },
      'image-delivery-insight': { score: 1, details: { debugData: { wastedBytes: 0 } } },
    }), failedAccessibilityAudits: [], diagnostics: { measurement: performanceMeasurement({ requestedUrl: pageUrl, finalUrl: pageUrl,
      lighthouseVersion: '13.0.0', configSettings: { formFactor: strategy, throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 4 } } }, strategy) },
    raw: {}, crux: null, ...overrides }
}
function context(data: PageSpeedResult, module = 'performance', device?: 'mobile'): TaskContext {
  const input = { pageUrl, position: 0, primary: true, role: 'primary', module, ...(device ? { device } : {}) }
  return {
    audit: { id: 'audit', executionSpec: { version: 1, targetUrl: pageUrl, environment: 'production',
      scope: 'SITE', checks: Object.fromEntries(Object.entries(CHECK_REGISTRY).map(([id, check]) => [id, check.version])),
      outcomes: [], verificationTarget: null } } as unknown as TaskContext['audit'],
    task: { id: 'check-task' } as TaskContext['task'], input, deadline: Date.now() + 10_000,
    dependencies: new Map([['speed', { workKind: 'pagespeed', workState: 'COMPLETED',
      workResult: serializeArtifact('pagespeed', { desktop: data.strategy === 'desktop' ? data : null,
        mobile: data.strategy === 'mobile' ? data : null }) } as unknown as TaskContext['task']]]),
  }
}

describe('progressive Performance evidence', () => {
  async function categoryMeasurement(data: PageSpeedResult, area: 'performance' | 'conversion') {
    const scoped = context(data, 'mobile')
    scoped.audit.executionSpec = { version: 1, engine: 'progressive-v1', scope: 'CATEGORY', targetUrl: pageUrl,
      environment: 'production', category: { area, sourceAuditId: 'original', pages: [pageUrl] },
      checks: Object.fromEntries(Object.entries(CHECK_REGISTRY).filter(([, definition]) => definition.module === 'mobile' && definition.area === area)
        .map(([id, definition]) => [id, definition.version])), outcomes: [], verificationTarget: null }
    return checkArtifactSchema.parse(readArtifact(await evaluate(scoped), 'check').data)
  }

  it('does not make Performance depend on unavailable Conversion evidence from the same provider response', async () => {
    const data = measurement({ tapTargetAudits: [] })
    const scoped = await categoryMeasurement(data, 'performance')
    expect(scoped.receipt).toMatchObject({ passed: true, complete: true })
    expect(scoped.receipt.assertions.some(assertion => assertion.key === 'tap-targets')).toBe(false)
    const broad = checkArtifactSchema.parse(readArtifact(await evaluate(context(data, 'mobile')), 'check').data)
    expect(broad.receipt).toMatchObject({ passed: false, complete: false })
  })

  it.each(['unavailable', 'failing'] as const)('keeps Conversion independent of %s performance measurements', async scenario => {
    const data = measurement(scenario === 'unavailable' ? { score: null, lcp: null, cls: null, resourceAudits: [] }
      : { score: 30, lcp: 6000, cls: 0.9 })
    const scoped = await categoryMeasurement(data, 'conversion')
    expect(scoped.flags).toEqual([])
    expect(scoped.receipt).toMatchObject({ passed: true, complete: true })
    expect(scoped.receipt.assertions.map(assertion => assertion.key)).toEqual(['tap-targets'])
    const broad = checkArtifactSchema.parse(readArtifact(await evaluate(context(data, 'mobile')), 'check').data)
    expect(broad.receipt.passed).toBe(false)
  })

  it('retains an applicable category failure and its comparable repair without unrelated requirements', async () => {
    const failed = await categoryMeasurement(measurement({ score: null, lcp: null, cls: null, resourceAudits: [],
      tapTargetAudits: readTapTargetAudits({ 'target-size': { score: 0 } }) }), 'conversion')
    expect(failed.flags.map(flag => flag.checkId)).toEqual(['tap-targets-small'])
    expect(failed.receipt).toMatchObject({ passed: false, complete: true })
    const repaired = await categoryMeasurement(measurement({ score: null, lcp: null, cls: null, resourceAudits: [] }), 'conversion')
    expect(scopedAssertionForTarget({ receipt: repaired.receipt, flag: failed.flags[0], checkId: 'tap-targets-small' })?.assertion)
      .toMatchObject({ passed: true, complete: true })
    const changed = await categoryMeasurement(measurement({ diagnostics: { measurement: performanceMeasurement({
      requestedUrl: pageUrl, finalUrl: pageUrl, lighthouseVersion: '14.0.0',
      configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 4 } },
    }, 'mobile') } }), 'conversion')
    expect(changed.receipt).toMatchObject({ passed: true, complete: true })
    expect(scopedAssertionForTarget({ receipt: changed.receipt, flag: failed.flags[0], checkId: 'tap-targets-small' })).toBeUndefined()
    const missing = await categoryMeasurement(measurement({ tapTargetAudits: [] }), 'conversion')
    expect(missing.receipt).toMatchObject({ passed: false, complete: false })
    expect(scopedAssertionForTarget({ receipt: missing.receipt, flag: failed.flags[0], checkId: 'tap-targets-small' })).toBeUndefined()
  })

  it.each([
    { module: 'performance', strategy: 'desktop' as const, checkId: 'perf-score-critical', failure: { score: 35 } },
    { module: 'performance', strategy: 'desktop' as const, checkId: 'unused-js-large', failure: {
      opportunities: [{ id: 'unused-javascript', title: 'Unused JS', savings: 200_000 }],
      resourceAudits: readResourceAudits({ 'unused-javascript': { score: 0, details: { overallSavingsBytes: 200_000 } } }),
    } },
    { module: 'mobile', strategy: 'mobile' as const, checkId: 'tap-targets-small', failure: { tapTargetAudits: readTapTargetAudits({ 'target-size': { score: 0 } }) } },
  ])('requires comparable measurement conditions to verify $checkId', async fixture => {
    const before = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: fixture.strategy, ...fixture.failure }), fixture.module)), 'check').data)
    const flag = before.flags.find(flag => flag.checkId === fixture.checkId)!
    expect(flag).toBeDefined()
    const healthy = measurement({ strategy: fixture.strategy })
    const comparable = checkArtifactSchema.parse(readArtifact(await evaluate(context(healthy, fixture.module)), 'check').data)
    expect(scopedAssertionForTarget({ receipt: comparable.receipt, checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
    const recovery = (receipt: typeof comparable.receipt) => hasRecordedRecoveryEvidence({ auditId: 'audit',
      executionSpec: context(healthy).audit.executionSpec, flag: { ...flag, pageUrl },
      executions: [{ targetKey: 'module:' + fixture.module, status: 'COMPLETED', detail: receipt }] })
    expect(recovery(comparable.receipt)).toBe(true)
    for (const changed of [
      { requestedUrl: pageUrl + '?different=1' }, { finalUrl: 'https://example.com/replacement' }, { lighthouseVersion: '14.0.0' },
      { configSettings: { formFactor: fixture.strategy, throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 1 } } },
      { configSettings: { formFactor: fixture.strategy, throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 4 }, screenEmulation: { width: 400, height: 800, mobile: true } } },
    ]) {
      const recorded = performanceMeasurement({ requestedUrl: pageUrl, finalUrl: pageUrl, lighthouseVersion: '13.0.0',
        configSettings: { formFactor: fixture.strategy, throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 4 } }, ...changed }, fixture.strategy)
      const after = checkArtifactSchema.parse(readArtifact(await evaluate(context({ ...healthy, diagnostics: { measurement: recorded } }, fixture.module)), 'check').data)
      expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: flag.checkId, flag })).toBeUndefined()
      expect(recovery(after.receipt)).toBe(false)
    }
    const missing = checkArtifactSchema.parse(readArtifact(await evaluate(context({ ...healthy, diagnostics: {} }, fixture.module)), 'check').data)
    expect(scopedAssertionForTarget({ receipt: missing.receipt, checkId: flag.checkId, flag })).toBeUndefined()
    expect(recovery(missing.receipt)).toBe(false)
    expect(scopedAssertionForTarget({ receipt: comparable.receipt, checkId: flag.checkId,
      flag: { ...flag, evidenceTargets: undefined } })).toBeUndefined()
  })
  it('verifies tap-target repairs only from the original mobile provider criteria', async () => {
    async function artifact(audits: Record<string, Record<string, unknown>>) {
      return checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ tapTargetAudits: readTapTargetAudits(audits) }), 'mobile')), 'check').data)
    }
    const failed = await artifact({ 'target-size': { score: 0, details: { items: [{}] } } })
    expect(failed.flags.map(flag => flag.checkId)).toEqual(['tap-targets-small'])
    const flag = { ...failed.flags[0], pageUrl }
    const sameFailure = scopedAssertionForTarget({ receipt: failed.receipt, checkId: flag.checkId, flag })
    expect(sameFailure?.assertion).toMatchObject({ passed: false, complete: true })
    const repaired = await artifact({ 'target-size': { score: 1 } })
    expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: true, complete: true })
    const unavailable: Array<Record<string, Record<string, unknown>>> = [
      {}, { 'tap-targets': { score: 1 } }, { 'target-size': { score: 1, scoreDisplayMode: 'error' } },
    ]
    for (const audits of unavailable) {
      const missing = await artifact(audits)
      expect(scopedAssertionForTarget({ receipt: missing.receipt, checkId: flag.checkId, flag })).toBeUndefined()
      expect(hasRecordedRecoveryEvidence({ auditId: 'audit', executionSpec: context(measurement()).audit.executionSpec, flag,
        executions: [{ targetKey: 'module:mobile', status: 'COMPLETED', detail: missing.receipt }] })).toBe(false)
    }
    expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId: flag.checkId, flag: { verificationRule: 'Historical unscoped audit' } })).toBeUndefined()
    expect(hasRecordedRecoveryEvidence({ auditId: 'audit', executionSpec: context(measurement()).audit.executionSpec, flag,
      executions: [{ targetKey: 'module:mobile', status: 'COMPLETED', detail: repaired.receipt }] })).toBe(true)
    const both = await artifact({ 'target-size': { score: 0 }, 'tap-targets': { score: 0.5 } })
    const knownFailure = await artifact({ 'target-size': { score: 0 } })
    expect(scopedAssertionForTarget({ receipt: knownFailure.receipt, checkId: flag.checkId, flag: both.flags[0] })?.assertion)
      .toMatchObject({ passed: false, complete: true })
    const partialRepair = await artifact({ 'target-size': { score: 1 } })
    expect(scopedAssertionForTarget({ receipt: partialRepair.receipt, checkId: flag.checkId, flag: both.flags[0] })).toBeUndefined()
    const fullRepair = await artifact({ 'target-size': { score: 1 }, 'tap-targets': { score: 1 } })
    expect(scopedAssertionForTarget({ receipt: fullRepair.receipt, checkId: flag.checkId, flag: both.flags[0] })?.assertion).toMatchObject({ passed: true, complete: true })
  })
  it('evaluates mobile resource failures independently of a healthy desktop and binds repair to mobile measurements', async () => {
    const resources = readResourceAudits({
      'render-blocking-insight': { score: 0, metricSavings: { FCP: 900 } },
      'unused-javascript': { score: 0, details: { overallSavingsBytes: 200_000 } },
      'unused-css-rules': { score: 0, details: { overallSavingsBytes: 80_000 } },
      'image-delivery-insight': { score: 0, details: { debugData: { wastedBytes: 150_000 } } },
    })
    const data = measurement({ resourceAudits: resources, opportunities: projectResourceOpportunities(resources) })
    const failed = checkArtifactSchema.parse(readArtifact(await evaluate(context(data, 'mobile')), 'check').data)
    const ids = ['mobile-render-blocking', 'mobile-unused-js-large', 'mobile-unused-css-large', 'mobile-unoptimized-images']
    expect(failed.flags.map(flag => flag.checkId)).toEqual(ids)
    expect(failed.receipt.execution?.source).toBe('pagespeed-mobile')
    const desktop = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop' }))), 'check').data)
    const repaired = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement(), 'mobile')), 'check').data)
    const missing = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ resourceAudits: [] }), 'mobile')), 'check').data)
    for (const checkId of ids) {
      expect(CHECK_REGISTRY[checkId]).toMatchObject({ module: 'mobile', area: 'performance' })
      expect(assertionForTarget(failed.receipt, checkId)).toMatchObject({ passed: false, complete: true })
      expect(assertionForTarget(desktop.receipt, checkId)).toBeUndefined()
      expect(assertionForTarget(repaired.receipt, checkId)).toMatchObject({ passed: true, complete: true })
      expect(assertionForTarget(missing.receipt, checkId)).toBeUndefined()
      const target = { auditId: 'audit', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
        environment: 'production', scope: 'SITE', checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null },
        flag: { ...failed.flags.find(flag => flag.checkId === checkId)!, pageUrl } }
      expect(hasRecordedRecoveryEvidence({ ...target, executions: [{ targetKey: 'module:performance', status: 'COMPLETED', detail: desktop.receipt }] })).toBe(false)
      expect(hasRecordedRecoveryEvidence({ ...target, executions: [{ targetKey: 'module:mobile', status: 'COMPLETED', detail: repaired.receipt }] })).toBe(true)
    }
    expect(missing.receipt).toMatchObject({ complete: false, passed: false })
  })

  it('evaluates mobile INP independently and emits only the field responsibility', async () => {
    const data = measurement({ lcp: 6000, inp: 650, crux: { lcp: null, cls: null, fcp: null, ttfb: null,
      inp: 650, formFactor: null, effectiveConnectionType: null, source: 'pagespeed-loading-experience',
      scope: 'page', url: pageUrl, reportingWindowDays: 28 } })
    const result = checkArtifactSchema.parse(readArtifact(await evaluate(context(data, 'performance', 'mobile')), 'check').data)
    expect(result.flags.map(flag => flag.checkId)).toEqual(['inp-critical'])
    expect(result.receipt).toMatchObject({ complete: true, passed: false, applicable: true,
      execution: { source: 'pagespeed-mobile' }, assertions: [{ key: 'inp', passed: false, disposition: 'observed' }] })
    expect(assertionForTarget(result.receipt, 'inp-critical')).toBeUndefined()
  })

  it('cannot pass mobile INP when field evidence is unavailable', async () => {
    const result = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement(), 'performance', 'mobile')), 'check').data)
    expect(result.flags).toEqual([])
    expect(result.receipt).toMatchObject({ complete: false, passed: false,
      assertions: [{ key: 'inp', complete: false, passed: false, observed: expect.stringContaining('unknown') }] })
  })

  it('does not turn healthy field data into proof of an immediate repair', async () => {
    const data = measurement({ inp: 100, crux: { lcp: null, cls: null, fcp: null, ttfb: null,
      inp: 100, formFactor: null, effectiveConnectionType: null, scope: 'origin', url: 'https://example.com/', reportingWindowDays: 28 } })
    const result = checkArtifactSchema.parse(readArtifact(await evaluate(context(data, 'performance', 'mobile')), 'check').data)
    expect(result.receipt).toMatchObject({ complete: true, passed: true,
      assertions: [{ key: 'inp', observed: expect.stringContaining('origin scope'), disposition: 'observed' }] })
    expect(assertionForTarget(result.receipt, 'inp-poor')).toBeUndefined()
  })

  it('records only desktop lab assertions for the desktop task', async () => {
    const result = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop' }))), 'check').data)
    expect(result.flags).toEqual([])
    expect(result.receipt).toMatchObject({ complete: true, passed: true, execution: { source: 'pagespeed-desktop' } })
    expect(result.receipt.assertions.map(assertion => assertion.key)).toEqual(['score', 'lcp', 'cls', 'render-blocking', 'unused-javascript', 'unused-css', 'image-optimization'])
  })

  it('gives exact score and resource repair proof without turning missing audits into success', async () => {
    const data = measurement({ strategy: 'desktop', score: 40, opportunities: [{ id: 'unused-javascript', title: 'Unused JS', savings: 200_000 }],
      resourceAudits: [{ id: 'unused-javascript', providerAuditId: 'unused-javascript', title: 'Unused JS', unit: 'bytes', score: 0, savings: 200_000 }] })
    const failed = checkArtifactSchema.parse(readArtifact(await evaluate(context(data)), 'check').data)
    expect(assertionForTarget(failed.receipt, 'perf-score-critical')).toMatchObject({ key: 'score', passed: false, complete: true })
    expect(assertionForTarget(failed.receipt, 'unused-js-large')).toMatchObject({ key: 'unused-javascript', passed: false, complete: true })
    expect(assertionForTarget(failed.receipt, 'render-blocking')).toBeUndefined()
    const repaired = checkArtifactSchema.parse(readArtifact(await evaluate(context({ ...data, score: 95, opportunities: [],
      resourceAudits: [{ ...data.resourceAudits![0], score: 1, savings: 0 }] })), 'check').data)
    expect(repaired.receipt.complete).toBe(false)
    expect(assertionForTarget(repaired.receipt, 'unused-js-large')).toMatchObject({ passed: true, complete: true })
    expect(assertionForTarget(repaired.receipt, 'perf-score-critical')).toMatchObject({ passed: true, complete: true })
    const missing = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop', resourceAudits: undefined }))), 'check').data)
    expect(assertionForTarget(missing.receipt, 'unused-js-large')).toBeUndefined()
  })

  it('retains available lab observations without passing incomplete measurements', async () => {
    const result = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop', cls: null }))), 'check').data)
    expect(result.receipt).toMatchObject({ complete: false, passed: false })
    expect(result.receipt.assertions.some(assertion => assertion.key === 'lcp')).toBe(true)
    expect(result.receipt.assertions.find(assertion => assertion.key === 'cls')).toMatchObject({ passed: false, complete: false })
  })

  it('requires every legacy image responsibility for recovery and accepts the consolidated current insight', async () => {
    const image = { id: 'uses-optimized-images', providerAuditId: 'uses-optimized-images', title: 'Images', unit: 'bytes', score: 0, savings: 80_000 } as const
    const failed = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop',
      opportunities: [{ id: image.id, title: image.title, savings: image.savings }], resourceAudits: [image] }))), 'check').data)
    expect(assertionForTarget(failed.receipt, 'unoptimized-images')).toMatchObject({ passed: false, complete: true })
    const subset = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop',
      resourceAudits: [{ ...image, score: 1, savings: 0 }] }))), 'check').data)
    expect(assertionForTarget(subset.receipt, 'unoptimized-images')).toBeUndefined()
    const allLegacy = readResourceAudits(Object.fromEntries(['uses-optimized-images', 'modern-image-formats', 'uses-responsive-images', 'efficient-animated-content']
      .map(id => [id, { score: 1, details: { overallSavingsBytes: 0 } }])))
    const legacyRepaired = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop', resourceAudits: allLegacy }))), 'check').data)
    expect(assertionForTarget(legacyRepaired.receipt, 'unoptimized-images')).toMatchObject({ passed: true, complete: true })
    const currentRepaired = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop' }))), 'check').data)
    expect(assertionForTarget(currentRepaired.receipt, 'unoptimized-images')).toMatchObject({ passed: true, complete: true })
  })

  it('keeps mobile score repair in its own measured device scope', async () => {
    const failed = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ score: 40 }), 'mobile')), 'check').data)
    expect(assertionForTarget(failed.receipt, 'mobile-perf-critical')).toMatchObject({ passed: false, complete: true })
    expect(assertionForTarget(failed.receipt, 'perf-score-critical')).toBeUndefined()
    const repaired = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement(), 'mobile')), 'check').data)
    expect(assertionForTarget(repaired.receipt, 'mobile-perf-critical')).toMatchObject({ passed: true, complete: true })
    expect(repaired.receipt.execution?.source).toBe('pagespeed-mobile')
  })

  it('keeps failed INP coverage in the same device scope as successful coverage', async () => {
    const upsert = vi.fn()
    const tx = { auditVerifierExecution: { upsert } } as unknown as Prisma.TransactionClient
    await publishUnfinishedCoverage(tx, { id: 'task', auditId: 'audit', workKind: 'check',
      workInput: context(measurement(), 'performance', 'mobile').input }, 'PROVIDER_QUOTA')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { auditId_targetKey_scopeKey: { auditId: 'audit', targetKey: 'module:performance', scopeKey: 'page:' + pageUrl + ':device:mobile' } },
      create: expect.objectContaining({ scopeKey: 'page:' + pageUrl + ':device:mobile', status: 'FAILED' }),
    }))
  })

  it('reports mobile layout shift and loading failures with matching repair assertions', async () => {
    const result = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ lcp: 3000, cls: 0.3 }), 'mobile')), 'check').data)
    expect(result.flags.map(flag => flag.checkId)).toEqual(['mobile-lcp-poor', 'mobile-cls-critical'])
    expect(result.receipt).toMatchObject({ passed: false, complete: true, execution: { source: 'pagespeed-mobile' } })
    expect(assertionForTarget(result.receipt, 'mobile-cls-critical')).toMatchObject({ key: 'cls', passed: false })
    const repaired = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement(), 'mobile')), 'check').data)
    expect(assertionForTarget(repaired.receipt, 'mobile-cls-critical')).toMatchObject({ key: 'cls', passed: true })
  })
})
