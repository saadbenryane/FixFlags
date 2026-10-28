import { describe, expect, it } from 'vitest'
import { healthyDesktopPs, healthyMeta, healthyMobilePs, pageSpeedMeasurementFixture } from '../__tests__/check-fixtures'
import { readResourceAudits } from '../pagespeed-opportunities'
import { runAllChecks } from './index'
import { recordCheckObservations } from './observations'
import { buildCoverageFacts } from '@/lib/sites/coverage'

const url = 'https://example.com/', metadata = healthyMeta()
const resources = readResourceAudits({
  'render-blocking-insight': { score: 1, metricSavings: { FCP: 0 } },
  'unused-javascript': { score: 1, details: { overallSavingsBytes: 0 } },
  'unused-css-rules': { score: 1, details: { overallSavingsBytes: 0 } },
  'image-delivery-insight': { score: 1, details: { debugData: { wastedBytes: 0 } } },
})
const desktop = healthyDesktopPs({ resourceAudits: resources, diagnostics: { measurement: pageSpeedMeasurementFixture(url) } })
const mobile = healthyMobilePs({ resourceAudits: resources, diagnostics: { measurement: pageSpeedMeasurementFixture(url, 'mobile') },
  tapTargetAudits: [{ id: 'target-size', title: 'Target size', score: 1 }] })

describe('shared performance measurement conclusions', () => {
  it.each(['performance', 'mobile'])('records missing and invalid lab vitals in %s without claiming a pass', module => {
    for (const value of [null, undefined, Number.NaN, -1]) {
      const data = { ...(module === 'mobile' ? mobile : desktop), lcp: value, cls: value }
      const assertions = recordCheckObservations(module, { url, metadata,
        desktop: data as typeof desktop, mobile: data as typeof mobile })
      for (const key of ['lcp', 'cls']) expect(assertions.find(assertion => assertion.key === key)).toMatchObject({ complete: false, passed: false })
      expect(assertions.find(assertion => assertion.key === 'score')).toMatchObject({ complete: true, passed: true })
    }
  })
  it('keeps both absent device measurements explicit through the legacy runner', async () => {
    const checked = await runAllChecks(url, metadata, null, null, [], undefined, null, undefined, undefined, false, ['performance', 'mobile'])
    for (const execution of checked.executions) {
      expect(execution).toMatchObject({ passed: false, complete: false })
      for (const key of ['score', 'lcp', 'cls'])
        expect(execution.assertions?.find(assertion => assertion.key === key)).toMatchObject({ passed: false, complete: false })
    }
    expect(checked.flags).toEqual([])
  })
  it('attributes missing mobile vitals to Performance while retaining completed mobile control evidence', async () => {
    const checked = await runAllChecks(url, metadata, desktop, { ...mobile, lcp: null, cls: null }, [], undefined,
      null, undefined, undefined, false, ['mobile'])
    expect(checked.executions[0]).toMatchObject({ passed: false, complete: false })
    const now = new Date()
    const facts = buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now,
      flags: checked.flags.map(flag => ({ ...flag, impactTag: flag.impactTag ?? null })),
      evidenceCoverage: { mobilePageSpeed: true, flowScan: true }, verifierExecutions: checked.executions.map(execution => ({
        targetKey: 'module:' + execution.module, status: 'COMPLETED', detail: { kind: 'site-module-check', version: 1, pageUrl: url, ...execution },
      })) })
    expect(facts.find(fact => fact.area === 'performance')).toMatchObject({ state: 'unknown' })
    expect(facts.find(fact => fact.area === 'conversion')).toMatchObject({ state: 'healthy' })
  })
  it('retains genuine failures and independent lab recovery while field responsiveness remains unknown', async () => {
    const failed = await runAllChecks(url, metadata, { ...desktop, lcp: 5000, cls: null }, null, [], undefined,
      null, undefined, undefined, false, ['performance'])
    expect(failed.flags.map(flag => flag.checkId)).toContain('lcp-critical')
    expect(failed.executions[0]).toMatchObject({ passed: false, complete: false })
    const repaired = await runAllChecks(url, metadata, desktop, mobile, [], undefined,
      null, undefined, undefined, false, ['performance', 'mobile'])
    expect(repaired.flags).toEqual([])
    const lab = repaired.executions.find(execution => execution.module === 'performance')!
    expect(lab).toMatchObject({ passed: false, complete: false })
    for (const key of ['score', 'lcp', 'cls']) expect(lab.assertions?.find(assertion => assertion.key === key)).toMatchObject({ passed: true, complete: true })
    expect(lab.assertions?.find(assertion => assertion.key === 'inp')).toMatchObject({ passed: false, complete: false, disposition: 'observed' })
    expect(repaired.executions.find(execution => execution.module === 'mobile')?.passed).toBe(true)
    const recordedField = { ...mobile, crux: { lcp: 1500, cls: 0.02, fcp: 800, inp: 150, ttfb: 100, formFactor: 'PHONE', effectiveConnectionType: '4G' } }
    const measured = await runAllChecks(url, metadata, desktop, recordedField, [], undefined,
      null, undefined, undefined, false, ['performance', 'mobile'])
    expect(measured.executions.every(execution => execution.passed && execution.complete !== false)).toBe(true)
  })
})
