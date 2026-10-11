import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { evaluatorHandlers } from '../evaluators'
import { readArtifact, serializeArtifact } from '../contracts'
import { checkArtifactSchema } from '../results'
import { assertionForTarget } from '../../checks/verification'
import { publishUnfinishedCoverage } from '../incomplete'
import type { TaskContext } from '../registry'
import type { PageSpeedResult } from '../../pagespeed'

const pageUrl = 'https://example.com/pricing'
const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
function measurement(overrides: Partial<PageSpeedResult> = {}): PageSpeedResult {
  return { strategy: 'mobile', score: 95, lcp: 1000, cls: 0, fcp: 500, tbt: 0, inp: null,
    opportunities: [], failedAccessibilityAudits: [], diagnostics: {}, raw: {}, crux: null, ...overrides }
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
    expect(result.receipt.assertions.map(assertion => assertion.key)).toEqual(['lcp', 'cls'])
  })

  it('retains available lab observations without passing incomplete measurements', async () => {
    const result = checkArtifactSchema.parse(readArtifact(await evaluate(context(measurement({ strategy: 'desktop', cls: null }))), 'check').data)
    expect(result.receipt).toMatchObject({ complete: false, passed: false, assertions: [{ key: 'lcp' }] })
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
