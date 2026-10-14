import { describe, expect, it } from 'vitest'
import { readTapTargetAudits, tapTargetAuditsSchema, tapTargetObservations } from './pagespeed-tap-targets'

describe('mobile tap-target normalization', () => {
  it('retains independent provider criteria and positive measurements without copying control details', () => {
    const audits = readTapTargetAudits({
      'target-size': { score: 1, title: 'Size and spacing', details: { items: [] } },
      'tap-targets': { score: 0, details: { items: [{ node: 'PRIVATE_CONTROL' }] } },
    })
    expect(tapTargetAuditsSchema.parse(audits)).toEqual([
      { id: 'target-size', title: 'Size and spacing', score: 1, itemsCount: 0 },
      { id: 'tap-targets', title: 'tap-targets', score: 0, itemsCount: 1 },
    ])
    expect(JSON.stringify(audits)).not.toContain('PRIVATE_CONTROL')
    expect(tapTargetObservations(audits)).toMatchObject([
      { context: 'pagespeed-tap-targets:target-size', complete: true, passed: true },
      { context: 'pagespeed-tap-targets:tap-targets', complete: true, passed: false },
    ])
  })
  it.each([
    { score: null }, {}, { score: 1, errorMessage: 'collection failed' },
    { score: 0, scoreDisplayMode: 'error' }, { score: 1, scoreDisplayMode: 'notApplicable' },
    { score: 1, notApplicable: true }, { score: 1, scoreDisplayMode: 'informative' },
  ])('does not turn an unmeasured audit into a finding or recovery: %j', audit => {
    const normalized = readTapTargetAudits({ 'target-size': audit })
    expect(normalized[0].score).toBeNull()
    expect(tapTargetObservations(normalized)[0]).toMatchObject({ complete: false, passed: false })
  })
  it('keeps missing audit evidence incomplete', () => {
    expect(readTapTargetAudits({})).toEqual([])
    expect(tapTargetObservations(undefined)[0]).toMatchObject({ complete: false, passed: false })
  })
})
