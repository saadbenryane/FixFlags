import { expect, it } from 'vitest'
import { readResourceAudits, resourceAuditsSchema } from '../pagespeed-opportunities'

it('keeps score-only, failed, informative and not-applicable audits unknown', () => {
  for (const audit of [
    { score: 1 }, { score: 1, notApplicable: true },
    { score: null, scoreDisplayMode: 'informative', metricSavings: { FCP: 0 } },
    { score: 1, scoreDisplayMode: 'error', errorMessage: 'No observation', metricSavings: { FCP: 0 } },
    { score: null, scoreDisplayMode: 'notApplicable', details: { type: 'table', items: [] } },
  ]) expect(readResourceAudits({ 'render-blocking-insight': audit })[0].savings).toBeNull()
})

it('rejects corrupted units, provider identities and duplicate responsibility observations', () => {
  const measured = readResourceAudits({ 'unused-javascript': { score: 1, details: { overallSavingsBytes: 0 } } })
  expect(resourceAuditsSchema.safeParse(measured).success).toBe(true)
  expect(resourceAuditsSchema.safeParse([{ ...measured[0], unit: 'ms' }]).success).toBe(false)
  expect(resourceAuditsSchema.safeParse([{ ...measured[0], providerAuditId: 'render-blocking-insight' }]).success).toBe(false)
  expect(resourceAuditsSchema.safeParse([...measured, ...measured]).success).toBe(false)
})
