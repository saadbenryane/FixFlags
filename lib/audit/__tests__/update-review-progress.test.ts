import { describe, expect, it } from 'vitest'
import {
  countsFromUpdateDiff,
  previousScoreFromHistory,
  scoreOffsetExplanation,
} from '@/lib/audit/update-review-progress'

const empty = {
  fixed: [],
  unchanged: [],
  newIssues: [],
  regressed: [],
  inconclusive: [],
}

describe('update-review-progress', () => {
  it('explains a flat score when Fixed work is offset by New observations', () => {
    const note = scoreOffsetExplanation({
      previousScore: 72,
      currentScore: 72,
      counts: countsFromUpdateDiff({
        ...empty,
        fixed: [{}, {}, {}],
        unchanged: [{}],
        newIssues: [{}, {}],
      }),
    })
    expect(note).toBe(
      'Score stayed at 72. 3 Flags from last time are gone, and 2 new observations appeared on pages already reviewed.'
    )
  })

  it('reads the previous history point score', () => {
    expect(
      previousScoreFromHistory(
        [
          { id: 'a', score: 64 },
          { id: 'b', score: 72 },
        ],
        'b'
      )
    ).toBe(64)
  })

  it('names newly reviewed pages separately from pages already reviewed', () => {
    const note = scoreOffsetExplanation({
      previousScore: 72,
      currentScore: 72,
      counts: countsFromUpdateDiff({
        ...empty,
        fixed: [{}],
        newIssues: [{ foundOnNewPage: true }, { foundOnNewPage: false }],
      }),
    })
    expect(note).toContain('on pages already reviewed')
    expect(note).toContain('on newly reviewed pages')
  })
})
