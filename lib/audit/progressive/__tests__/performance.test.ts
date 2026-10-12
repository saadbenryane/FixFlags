import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { evaluatorHandlers } from '../evaluators'
import { readArtifact, serializeArtifact } from '../contracts'
import { checkArtifactSchema } from '../results'
import { assertionForTarget } from '../../checks/verification'
import { publishUnfinishedCoverage } from '../incomplete'
import type { TaskContext } from '../registry'
import type { PageSpeedResult } from '../../pagespeed'
import { readResourceAudits } from '../../pagespeed-opportunities'

const pageUrl = 'https://example.com/pricing'
const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
function measurement(overrides: Partial<PageSpeedResult> = {}): PageSpeedResult {
  return { strategy: 'mobile', score: 95, lcp: 1000, cls: 0, fcp: 500, tbt: 0, inp: null,
    opportunities: [], resourceAudits: readResourceAudits({
      'render-blocking-insight': { score: 1, metricSavings: { FCP: 0 } },
      'unused-javascript': { score: 1, details: { overallSavingsBytes: 0 } },
      'unused-css-rules': { score: 1, details: { overallSavingsBytes: 0 } },
      'image-delivery-insight': { score: 1, details: { debugData: { wastedBytes: 0 } } },
    }), failedAccessibilityAudits: [], diagnostics: {}, raw: {}, crux: null, ...overrides }
}
function context(data: PageSpeedResult, module = 'performance', device?: 'mobile'): TaskContext {
  const input = { pageUrl, position: 0, primary: true, role: 'primary', module, ...(device ? { device } : {}) }
  return {
    audit: { id: 'audit', executionSpec: { version: 1, targetUrl: pageUrl, environment: 'production',
      scope: 'SITE', checks: { 'inp-critical': 1, 'inp-poor': 1, 'lcp-poor': 1, 'mobile-lcp-critical': 1 },
      outcomes: [], verificationTarget: null } } as TaskContext['audit'],
    task: { id: 'check-task' } as TaskContext['task'], input, deadline: Date.now() + 10_000,
    dependencies: new Map([['speed', { workKind: 'pagespeed', workState: 'COMPLETED',
      workResult: serializeArtifact('pagespeed', { desktop: data.strategy === 'desktop' ? data : null,
        mobile: data.strategy === 'mobile' ? data : null }) } as TaskContext['task']]]),
  }
}

describe('progressive Performance evidence', () => {
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
    expect(result.receipt.assertions.some(assertion => assertion.key === 'cls')).toBe(false)
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
