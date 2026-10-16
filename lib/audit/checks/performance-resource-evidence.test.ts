import { describe, expect, it } from 'vitest'
import { healthyDesktopPs, healthyMeta, healthyMobilePs, pageSpeedMeasurementFixture } from '../__tests__/check-fixtures'
import { projectResourceOpportunities, readResourceAudits } from '../pagespeed-opportunities'
import type { PageSpeedResult } from '../pagespeed'
import { runResourceChecks } from './performance'
import { recordCheckObservations } from './observations'
import { scopedAssertionForTarget } from './verification'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'

const url = 'https://example.com/'
const imageAudits = (failed: boolean) => readResourceAudits(Object.fromEntries([
  'uses-optimized-images', 'uses-webp-images', 'uses-responsive-images', 'efficient-animated-content',
].map(id => [id, { score: failed && id === 'uses-optimized-images' ? 0 : 1,
  details: { overallSavingsBytes: failed && id === 'uses-optimized-images' ? 100_000 : 0 } }])))
function measurement(device: 'desktop' | 'mobile', audits: PageSpeedResult['resourceAudits'], pageUrl = url) {
  return (device === 'desktop' ? healthyDesktopPs : healthyMobilePs)({ resourceAudits: audits, opportunities: projectResourceOpportunities(audits ?? []),
    diagnostics: { measurement: pageSpeedMeasurementFixture(pageUrl, device) } })
}
function receipt(data: PageSpeedResult, pageUrl = url) {
  const checkModule = data.strategy === 'desktop' ? 'performance' : 'mobile'
  return { kind: 'site-module-check' as const, version: 1 as const, module: checkModule, pageUrl, applicable: true, passed: true, complete: true,
    assertions: recordCheckObservations(checkModule, { url: pageUrl, metadata: healthyMeta(), desktop: data, mobile: data }),
    execution: { auditId: 'after', taskId: 'resource-check', checkVersion: 1, source: ('pagespeed-' + data.strategy) as 'pagespeed-desktop' | 'pagespeed-mobile',
      collectedAt: '2026-10-15T12:00:00Z' } }
}

describe('provider resource repair criteria', () => {
  it.each(['desktop', 'mobile'] as const)('keeps render-blocking provider criteria distinct on %s', device => {
    const original = measurement(device, readResourceAudits({ 'render-blocking-insight': { score: 0, metricSavings: { FCP: 900 } } }))
    const flag = runResourceChecks(original, url).find(flag => flag.checkId.endsWith('render-blocking'))!
    const different = measurement(device, readResourceAudits({ 'render-blocking-resources': { score: 1, details: { overallSavingsMs: 0 } } }))
    expect(scopedAssertionForTarget({ receipt: receipt(different), checkId: flag.checkId, flag })).toBeUndefined()
    const repaired = measurement(device, readResourceAudits({ 'render-blocking-insight': { score: 1, metricSavings: { FCP: 0 } } }))
    expect(scopedAssertionForTarget({ receipt: receipt(repaired), checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
  })

  it.each(['desktop', 'mobile'] as const)('does not certify a different image audit as %s repair', device => {
    const original = measurement(device, imageAudits(true))
    const flag = runResourceChecks(original, url).find(flag => flag.checkId.endsWith('unoptimized-images'))!
    const different = measurement(device, readResourceAudits({ 'image-delivery-insight': { score: 1, details: { overallSavingsBytes: 0 } } }))
    expect(scopedAssertionForTarget({ receipt: receipt(different), checkId: flag.checkId, flag })).toBeUndefined()
    const repaired = measurement(device, imageAudits(false))
    expect(scopedAssertionForTarget({ receipt: receipt(repaired), checkId: flag.checkId, flag })?.assertion)
      .toMatchObject({ complete: true, passed: true })
    expect(scopedAssertionForTarget({ receipt: receipt(original), checkId: flag.checkId, flag })?.assertion)
      .toMatchObject({ complete: true, passed: false })
  })

  it('retains original completeness requirements, device and threshold through repair', () => {
    const original = measurement('desktop', imageAudits(true))
    const flag = runResourceChecks(original, url)[0]
    const incomplete = measurement('desktop', readResourceAudits({ 'uses-optimized-images': { score: 1, details: { overallSavingsBytes: 0 } } }))
    expect(scopedAssertionForTarget({ receipt: receipt(incomplete), checkId: flag.checkId, flag })).toBeUndefined()
    const mobile = measurement('mobile', imageAudits(false))
    expect(scopedAssertionForTarget({ receipt: receipt(mobile), checkId: flag.checkId, flag })).toBeUndefined()
    const differentThreshold = { ...flag, evidenceTargets: flag.evidenceTargets!.map(target => ({
      ...target, context: target.context!.replace(':50000', ':100000'),
    })) }
    const repaired = measurement('desktop', imageAudits(false))
    expect(scopedAssertionForTarget({ receipt: receipt(repaired), checkId: flag.checkId, flag: differentThreshold })).toBeUndefined()
  })

  it('retains unscoped historical findings without certifying their unknown criteria', () => {
    const original = measurement('desktop', imageAudits(true))
    const historical = runResourceChecks({ ...original, resourceAudits: undefined }, url)[0]
    expect(historical).toMatchObject({ checkId: 'unoptimized-images', severity: 'IMPORTANT' })
    expect(historical.evidenceTargets).toBeUndefined()
    const repaired = measurement('desktop', imageAudits(false))
    expect(scopedAssertionForTarget({ receipt: receipt(repaired), checkId: historical.checkId, flag: historical })).toBeUndefined()
  })

  it('verifies merged findings using the original criteria of each page without exposing query values', () => {
    const first = url + 'first?token=PRIVATE_TOKEN', second = url + 'second'
    const legacy = runResourceChecks(measurement('desktop', imageAudits(true), first), first)[0]
    const current = runResourceChecks(measurement('desktop', readResourceAudits({
      'image-delivery-insight': { score: 0, details: { overallSavingsBytes: 100_000 } },
    }), second), second)[0]
    const merged = { ...legacy, evidenceTargets: [...legacy.evidenceTargets!, ...current.evidenceTargets!] }
    const repairedLegacy = measurement('desktop', imageAudits(false), first)
    const repairedCurrent = measurement('desktop', readResourceAudits({ 'image-delivery-insight': { score: 1, details: { overallSavingsBytes: 0 } } }), second)
    expect(scopedAssertionForTarget({ receipt: receipt(repairedLegacy, first), checkId: legacy.checkId, flag: merged })?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ receipt: receipt(repairedCurrent, second), checkId: current.checkId, flag: merged })?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ receipt: receipt(repairedCurrent, first), checkId: legacy.checkId, flag: merged })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(repairedLegacy, url + 'third'), checkId: legacy.checkId, flag: merged })).toBeUndefined()
    expect(JSON.stringify(merged.evidenceTargets)).not.toContain('PRIVATE_TOKEN')
    const recovery = { auditId: 'after', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: first,
      environment: 'production', scope: 'SITE', checks: { 'unoptimized-images': 1 }, outcomes: [], verificationTarget: null },
      flag: { ...merged, pageUrl: first, affectedPaths: [first, second] } }
    const sources = [receipt(repairedLegacy, first), receipt(repairedCurrent, second)].map(detail => ({
      targetKey: 'module:performance', status: 'COMPLETED', detail,
    }))
    expect(hasRecordedRecoveryEvidence({ ...recovery, executions: sources })).toBe(true)
    expect(hasRecordedRecoveryEvidence({ ...recovery, executions: sources.slice(0, 1) })).toBe(false)
  })

  it.each(['desktop', 'mobile'] as const)('retains an original measured %s image failure when another original provider audit is unavailable', device => {
    const original = measurement(device, readResourceAudits({
      'uses-optimized-images': { score: 0, details: { overallSavingsBytes: 100_000 } },
      'uses-webp-images': { score: 0, details: { overallSavingsBytes: 80_000 } },
      'uses-responsive-images': { score: 1, details: { overallSavingsBytes: 0 } },
      'efficient-animated-content': { score: 1, details: { overallSavingsBytes: 0 } },
    }))
    const flag = runResourceChecks(original, url).find(flag => flag.checkId.endsWith('unoptimized-images'))!
    expect(flag.evidenceTargets).toHaveLength(2)
    const partial = measurement(device, readResourceAudits({
      'uses-optimized-images': { score: 0, details: { overallSavingsBytes: 90_000 } },
    }))
    const comparison = scopedAssertionForTarget({ receipt: receipt(partial), checkId: flag.checkId, flag })
    expect(comparison?.assertion).toMatchObject({ complete: true, passed: false })
    expect(comparison?.assertion.observed).toContain('1 of 2 original comparisons remain unavailable')
    const unproven = measurement(device, readResourceAudits({
      'uses-optimized-images': { score: 1, details: { overallSavingsBytes: 0 } },
    }))
    expect(scopedAssertionForTarget({ receipt: receipt(unproven), checkId: flag.checkId, flag })).toBeUndefined()
    const differentFailure = measurement(device, readResourceAudits({
      'uses-optimized-images': { score: 1, details: { overallSavingsBytes: 0 } },
      'uses-responsive-images': { score: 0, details: { overallSavingsBytes: 150_000 } },
    }))
    expect(scopedAssertionForTarget({ receipt: receipt(differentFailure), checkId: flag.checkId, flag })).toBeUndefined()
  })


  it('keeps historical aggregate receipts usable without inventing individual measurement results', () => {
    const original = measurement('desktop', readResourceAudits({
      'uses-optimized-images': { score: 0, details: { overallSavingsBytes: 100_000 } },
      'uses-webp-images': { score: 0, details: { overallSavingsBytes: 100_000 } },
    }))
    const flag = runResourceChecks(original, url)[0]
    const partial = receipt(measurement('desktop', readResourceAudits({
      'uses-optimized-images': { score: 0, details: { overallSavingsBytes: 100_000 } },
    })))
    const historical = { ...partial, assertions: partial.assertions.map(assertion => ({ ...assertion, measurements: undefined })) }
    expect(scopedAssertionForTarget({ receipt: historical, checkId: flag.checkId, flag })).toBeUndefined()
    const full = receipt(original)
    expect(scopedAssertionForTarget({ receipt: { ...full, assertions: full.assertions.map(assertion => ({ ...assertion, measurements: undefined })) },
      checkId: flag.checkId, flag })?.assertion.passed).toBe(false)
  })

  it('preserves the complete legacy image-family requirement after the original failed audits improve', () => {
    const original = measurement('desktop', readResourceAudits({
      'uses-optimized-images': { score: 0, details: { overallSavingsBytes: 100_000 } },
      'uses-webp-images': { score: 0, details: { overallSavingsBytes: 100_000 } },
    }))
    const flag = runResourceChecks(original, url)[0]
    const partial = measurement('desktop', readResourceAudits({
      'uses-optimized-images': { score: 1, details: { overallSavingsBytes: 0 } },
      'uses-webp-images': { score: 1, details: { overallSavingsBytes: 0 } },
    }))
    expect(scopedAssertionForTarget({ receipt: receipt(partial), checkId: flag.checkId, flag })).toBeUndefined()
    const full = measurement('desktop', imageAudits(false))
    expect(scopedAssertionForTarget({ receipt: receipt(full), checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
    const newlyFailed = measurement('desktop', readResourceAudits({
      'uses-optimized-images': { score: 1, details: { overallSavingsBytes: 0 } },
      'uses-webp-images': { score: 1, details: { overallSavingsBytes: 0 } },
      'uses-responsive-images': { score: 0, details: { overallSavingsBytes: 100_000 } },
      'efficient-animated-content': { score: 1, details: { overallSavingsBytes: 0 } },
    }))
    expect(scopedAssertionForTarget({ receipt: receipt(newlyFailed), checkId: flag.checkId, flag })?.assertion.passed).toBe(false)
  })

})
