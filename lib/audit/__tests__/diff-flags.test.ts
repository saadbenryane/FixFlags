import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { classifyArbitraryReportFlagDiff, classifyMatchedFlagDiff } from '@/lib/audit/diff-flags'

describe('diff-flags', () => {
  it('classifies a previously fixed issue that reappears as regressed', () => {
    assert.equal(
      classifyMatchedFlagDiff({
        parentStatus: 'FIXED',
        parentSeverity: 'IMPORTANT',
        monitoringStatus: 'OPEN',
        monitoringSeverity: 'IMPORTANT',
      }),
      'regressed'
    )
  })

  it('lets a monitoring regression beat an old fixed parent in summaries', () => {
    assert.equal(
      classifyMatchedFlagDiff({
        parentStatus: 'FIXED',
        parentSeverity: 'IMPORTANT',
        monitoringStatus: 'REGRESSED',
        monitoringSeverity: 'IMPORTANT',
      }),
      'regressed'
    )
  })

  it('keeps still-failing matched issues unchanged unless they regress', () => {
    assert.equal(
      classifyMatchedFlagDiff({
        parentStatus: 'OPEN',
        parentSeverity: 'IMPORTANT',
        monitoringStatus: 'OPEN',
        monitoringSeverity: 'IMPORTANT',
      }),
      'unchanged'
    )
  })

  it('treats explicitly fixed monitoring rows as fixed', () => {
    assert.equal(
      classifyMatchedFlagDiff({
        parentStatus: 'REGRESSED',
        parentSeverity: 'CRITICAL',
        monitoringStatus: 'FIXED',
        monitoringSeverity: 'CRITICAL',
      }),
      'fixed'
    )
  })
})

describe('classifyArbitraryReportFlagDiff', () => {
  it('ignores a stale FIXED status from an unrelated prior monitoring cycle', () => {
    // Regression test: before this fix, ff_compare reused each flag's persisted
    // `status` field (set relative to that flag's OWN real parent audit) even when
    // comparing two arbitrary reports with no real parent/child relationship. A
    // flag that happened to carry a stale 'FIXED' status from a totally unrelated
    // earlier monitoring cycle would then be misclassified as 'fixed' here, even
    // though nothing was fixed between the two reports actually being compared.
    assert.equal(
      classifyArbitraryReportFlagDiff({ beforeSeverity: 'IMPORTANT', afterSeverity: 'IMPORTANT' }),
      'unchanged'
    )
  })

  it('flags a real severity increase as regressed', () => {
    assert.equal(
      classifyArbitraryReportFlagDiff({ beforeSeverity: 'IMPORTANT', afterSeverity: 'CRITICAL' }),
      'regressed'
    )
  })

  it('treats a severity decrease as unchanged (no dedicated "improved" bucket)', () => {
    assert.equal(
      classifyArbitraryReportFlagDiff({ beforeSeverity: 'CRITICAL', afterSeverity: 'POLISH' }),
      'unchanged'
    )
  })

  it('treats identical severities as unchanged', () => {
    assert.equal(
      classifyArbitraryReportFlagDiff({ beforeSeverity: 'POLISH', afterSeverity: 'POLISH' }),
      'unchanged'
    )
  })
})
