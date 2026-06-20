import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  formatScoreInline,
  resolveScoreDisplay,
} from '@/lib/audit/score-display'

describe('score-display', () => {
  it('resolveScoreDisplay uses numeric mode for overall score', () => {
    const result = resolveScoreDisplay({ grade: 'B', score: 78, isOverall: true })
    assert.equal(result.mode, 'numeric')
    assert.equal(result.primary, '78')
    assert.equal(result.secondary, 'Grade B')
    assert.equal(result.caption, '/ 100')
  })

  it('resolveScoreDisplay uses grade mode when score is available without overall flag', () => {
    const result = resolveScoreDisplay({
      grade: 'C',
      score: 62,
    })
    assert.equal(result.mode, 'grade')
    assert.equal(result.primary, 'C')
    assert.equal(result.secondary, '62/100')
  })

  it('resolveScoreDisplay handles missing values', () => {
    const result = resolveScoreDisplay({ grade: null, score: null })
    assert.equal(result.primary, '-')
    assert.equal(result.mode, 'grade')
  })

  it('formatScoreInline formats overall score', () => {
    assert.equal(formatScoreInline(78, 'B', { isOverall: true }), '78/100 · Grade B')
  })

  it('formatScoreInline formats grade-only rubric', () => {
    assert.equal(formatScoreInline(50, 'D'), 'Grade D')
  })

  it('formatScoreInline handles unavailable score', () => {
    assert.equal(formatScoreInline(null, null), '-')
  })
})
