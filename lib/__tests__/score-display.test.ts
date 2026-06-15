import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  areaScoreForDisplay,
  formatScoreInline,
  isObjectiveArea,
  resolveScoreDisplay,
} from '@/lib/audit/score-display'

describe('score-display', () => {
  it('isObjectiveArea identifies numeric areas', () => {
    assert.equal(isObjectiveArea('PERFORMANCE'), true)
    assert.equal(isObjectiveArea('MOBILE'), true)
    assert.equal(isObjectiveArea('CONVERSION'), false)
    assert.equal(isObjectiveArea('TRUST'), false)
  })

  it('resolveScoreDisplay uses numeric mode for overall score', () => {
    const result = resolveScoreDisplay({ grade: 'B', score: 78 })
    assert.equal(result.mode, 'numeric')
    assert.equal(result.primary, '78')
    assert.equal(result.secondary, 'Grade B')
    assert.equal(result.caption, '/ 100')
  })

  it('resolveScoreDisplay uses numeric mode for objective areas', () => {
    const result = resolveScoreDisplay({
      areaName: 'SEO',
      grade: 'C',
      score: 62,
    })
    assert.equal(result.mode, 'numeric')
    assert.equal(result.primary, '62')
    assert.equal(result.secondary, 'Grade C')
  })

  it('resolveScoreDisplay uses grade mode for subjective areas', () => {
    const result = resolveScoreDisplay({
      areaName: 'CONVERSION',
      grade: 'D',
      score: 50,
    })
    assert.equal(result.mode, 'grade')
    assert.equal(result.primary, 'D')
    assert.equal(result.caption, 'Experience grade')
    assert.equal(result.score, null)
  })

  it('resolveScoreDisplay handles missing values', () => {
    const result = resolveScoreDisplay({ grade: null, score: null })
    assert.equal(result.primary, '-')
    assert.equal(result.mode, 'grade')
  })

  it('formatScoreInline formats overall score', () => {
    assert.equal(formatScoreInline(78, 'B'), '78/100 · Grade B')
  })

  it('formatScoreInline formats grade-only subjective area', () => {
    assert.equal(
      formatScoreInline(50, 'D', { areaName: 'TRUST' }),
      'Grade D'
    )
  })

  it('formatScoreInline handles unavailable score', () => {
    assert.equal(formatScoreInline(null, null), '—')
  })

  it('areaScoreForDisplay returns score only for objective areas', () => {
    assert.equal(areaScoreForDisplay({ name: 'SEO', score: 80 }), 80)
    assert.equal(areaScoreForDisplay({ name: 'TRUST', score: 80 }), null)
  })
})
