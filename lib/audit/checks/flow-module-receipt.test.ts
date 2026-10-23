import { describe, expect, it } from 'vitest'
import { assembleFlowModuleCheck } from './flow-module-receipt'
import { runFlowChecks } from './flow'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema, summarizeCheckAssertions } from './receipt'
import { projectCheckResults } from '@/lib/sites/check-results'
import { buildCoverageFacts } from '@/lib/sites/coverage'
import type { PrimaryActionEvidence } from '../flow/primary-action-evidence'
import type { DestinationUXQuality } from '../flow/destination-ux-probes'
import type { FlowScanResult } from '../flow/run-flow-scan'

const pageUrl = 'https://example.com/signup'
const action: PrimaryActionEvidence = { version: 1, pageContext: 'flow:page:' + 'a'.repeat(64), controlContext: 'flow:control:' + 'b'.repeat(64),
  candidateCount: 1, clicked: true, clickBlocked: false, navigation: 'changed', responseExpected: true, response: 'healthy', httpStatus: 200 }
function ux(overrides: Partial<DestinationUXQuality> = {}): DestinationUXQuality {
  return {
    contentComplete: true, controlsComplete: true, hasClearHeadline: true, hasPrimaryCTA: true, ctaText: 'Continue', ctaPromisesMatch: true,
    headline: 'Start the useful service', pageType: null, visibleCtaCount: 1, actionableCtaCount: 1, primaryCtaHref: '/next',
    trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
    mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
    frictionSignals: { ctaCount: 1, distinctCtaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false },
    loadQuality: { hadStuckLoading: false, timeToContentMs: 100, layoutShift: false }, ...overrides,
    trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true, ...overrides.trustSignals },
    frictionSignals: { ctaCount: 1, distinctCtaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false, ...overrides.frictionSignals },
  }
}
function scan(destination: DestinationUXQuality | undefined, evidence: PrimaryActionEvidence = action, status: FlowScanResult['status'] = 'success'): FlowScanResult {
  return { status, steps: [], finalUrl: pageUrl, ctaText: 'Get started', httpStatus: evidence.httpStatus ?? undefined,
    ...(destination ? { destinationUX: destination, destinationTrust: destination.trustSignals } : {}), actionEvidence: evidence }
}
function stored(result: FlowScanResult) {
  const flags = runFlowChecks(result, null)
  const check = assembleFlowModuleCheck({ result, actionRequired: null, actionFlags: flags, pricingOnly: false, targetedPricing: false })
  const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'flow', pageUrl, ...check,
    execution: { auditId: 'audit', taskId: 'flow-task', checkVersion: 1, source: 'rendered-dom', collectedAt: '2026-10-18T12:00:00.000Z' } })
  return { flags, check, receipt: { ...receipt, ...summarizeCheckAssertions(receipt) } }
}
function results(receipt: ReturnType<typeof stored>['receipt']) {
  return projectCheckResults('audit', [{ id: 'row', targetKey: 'module:flow', status: 'COMPLETED', pageUrl, updatedAt: new Date('2026-10-18T12:00:00.000Z'), detail: receipt }])
}
function conversion(receipt: ReturnType<typeof stored>['receipt'], flags: ReturnType<typeof stored>['flags']) {
  return buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: new Date('2026-10-18T12:00:00.000Z'), now: new Date('2026-10-18T12:00:00.000Z'),
    evidenceCoverage: { flowScan: true }, flags, verifierExecutions: [{ targetKey: 'module:flow', status: 'COMPLETED', pageUrl, detail: receipt, workKind: 'flow' }] })
    .find(fact => fact.area === 'conversion')
}

describe('flow module receipt', () => {
  it('retains observations through a refused action without certifying the affected action', () => {
    const check = assembleFlowModuleCheck({ result: scan(ux()), actionRequired: true, actionFlags: [], pricingOnly: false,
      targetedPricing: false, protectedActionRefused: true })
    expect(check).toMatchObject({ applicable: true, complete: false, passed: false })
    expect(check.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'primary-action-response', complete: true, passed: true }),
      expect.objectContaining({ key: 'destination-trust', complete: true, passed: true }),
      expect.objectContaining({ key: 'public-action-boundary', complete: false, passed: false }),
    ]))
  })
  it('records a reached destination as passed only when trust and content were conclusive', () => {
    const healthy = stored(scan(ux()))
    expect(healthy.flags).toEqual([])
    expect(healthy.receipt).toMatchObject({ complete: true, passed: true })
    expect(healthy.receipt.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'destination-trust', complete: true, passed: true }),
      expect.objectContaining({ key: 'destination-headline', complete: true, passed: true }),
    ]))
    expect(results(healthy.receipt).find(item => item.kind === 'execution')?.status).toBe('completed')
    expect(conversion(healthy.receipt, healthy.flags)?.state).toBe('healthy')
  })

  it('keeps an unrecorded contact signal incomplete and still verifies an unrelated action repair', () => {
    const broken = runFlowChecks(scan(undefined, { ...action, response: 'error', httpStatus: 404 }, 'error_response'), null)
      .find(flag => flag.checkId === 'flow-cta-404')
    const missingTrust = runFlowChecks(scan(ux({ trustSignals: { hasPrivacyPolicy: false, hasContactInfo: true, isHttps: true } })), null)
      .find(flag => flag.checkId === 'flow-cta-destination-no-trust')
    const unknown = stored(scan(ux({ trustSignals: { hasPrivacyPolicy: true, hasContactInfo: null, isHttps: true } })))
    expect(unknown.flags.map(flag => flag.checkId)).not.toContain('flow-cta-destination-no-trust')
    expect(unknown.receipt).toMatchObject({ complete: false, passed: false })
    expect(unknown.receipt.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'destination-trust', complete: false, passed: false }),
      expect.objectContaining({ key: 'primary-action-response', complete: true, passed: true }),
    ]))
    expect(results(unknown.receipt).find(item => item.assertionKey === 'destination-trust')?.status).toBe('unknown')
    expect(results(unknown.receipt).find(item => item.kind === 'execution')?.status).toBe('unknown')
    expect(conversion(unknown.receipt, unknown.flags)?.state).toBe('unknown')
    expect(scopedAssertionForTarget({ receipt: unknown.receipt, flag: missingTrust!, checkId: 'flow-cta-destination-no-trust' })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: unknown.receipt, flag: broken!, checkId: 'flow-cta-404' })?.assertion.passed).toBe(true)
    const failed = stored(scan(ux({ trustSignals: { hasPrivacyPolicy: false, hasContactInfo: true, isHttps: true } })))
    expect(failed.receipt).toMatchObject({ complete: true, passed: false })
    expect(conversion(failed.receipt, failed.flags)?.state).toBe('problem')
    expect(scopedAssertionForTarget({ receipt: failed.receipt, flag: missingTrust!, checkId: 'flow-cta-destination-no-trust' })?.assertion.passed).toBe(false)
    expect(scopedAssertionForTarget({ receipt: healthyReceipt(), flag: missingTrust!, checkId: 'flow-cta-destination-no-trust' })?.assertion.passed).toBe(true)
  })

  it('keeps an unfinished destination headline on the receipt without certifying the earlier failure', () => {
    const missing = runFlowChecks(scan(ux({ hasClearHeadline: false, headline: null })), null).find(flag => flag.checkId === 'flow-destination-no-headline')
    const unfinished = stored(scan(ux({ contentComplete: false, hasClearHeadline: false, headline: null })))
    expect(unfinished.flags.map(flag => flag.checkId)).not.toContain('flow-destination-no-headline')
    expect(unfinished.receipt.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'destination-headline', complete: false, passed: false }),
    ]))
    expect(unfinished.receipt.complete).toBe(false)
    expect(scopedAssertionForTarget({ receipt: unfinished.receipt, flag: missing!, checkId: 'flow-destination-no-headline' })).toBeUndefined()
  })
})

function healthyReceipt() {
  return stored(scan(ux())).receipt
}
