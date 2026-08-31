import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  clampFlagIndex,
  countFlagsByRubric,
  filterExplorerFlags,
  initialExplorerFlagIndex,
  resolveRubricFilter,
} from '@/lib/report/explorer-filters'
import type { ExplorerFlag } from '@/lib/report/explorer-model'

function flag(
  partial: Partial<ExplorerFlag> & Pick<ExplorerFlag, 'id' | 'rubric' | 'severity'>
): ExplorerFlag {
  return {
    title: 'Problem',
    checkId: null,
    rubricLabel: partial.rubric,
    severityLabel: partial.severity,
    impactTag: null,
    whyItMatters: '',
    evidence: '',
    fixPrompt: '',
    copyFixPrompt: '',
    toolPrompts: {},
    verificationRule: null,
    affectedDevices: ['desktop'],
    hasFixPrompt: false,
    pageUrl: null,
    pageUrls: [],
    occurrenceCount: 1,
    truthLabel: 'Detected',
    ...partial,
  }
}

const FLAGS: ExplorerFlag[] = [
  flag({ id: '1', rubric: 'MESSAGE', severity: 'CRITICAL', impactTag: 'CONVERSION', pageUrl: 'https://ex.com/', pageUrls: ['https://ex.com/'] }),
  flag({ id: '2', rubric: 'MESSAGE', severity: 'IMPORTANT', impactTag: 'TRUST', pageUrl: 'https://ex.com/pricing', pageUrls: ['https://ex.com/pricing'] }),
  flag({ id: '3', rubric: 'EXPERIENCE', severity: 'CRITICAL', impactTag: 'ACCESSIBILITY', pageUrl: 'https://ex.com/', pageUrls: ['https://ex.com/'] }),
  flag({ id: '4', rubric: 'REACH', severity: 'POLISH', impactTag: 'SEO', pageUrl: 'https://ex.com/pricing', pageUrls: ['https://ex.com/pricing'] }),
]

describe('explorer-filters', () => {
  it('countFlagsByRubric totals by rubric', () => {
    assert.deepEqual(countFlagsByRubric(FLAGS), {
      MESSAGE: 2,
      EXPERIENCE: 1,
      REACH: 1,
    })
  })

  it('filterExplorerFlags keeps the requested rubric', () => {
    const filtered = filterExplorerFlags(FLAGS, {
      rubricFilter: 'MESSAGE',
    })
    assert.deepEqual(
      filtered.map((f) => f.id),
      ['1', '2']
    )
  })

  it('resolveRubricFilter resets when the rubric disappears', () => {
    assert.equal(resolveRubricFilter('ALL', { MESSAGE: 0, EXPERIENCE: 0, REACH: 0 }), 'ALL')
    assert.equal(
      resolveRubricFilter('REACH', { MESSAGE: 1, EXPERIENCE: 0, REACH: 0 }),
      'ALL'
    )
    assert.equal(
      resolveRubricFilter('MESSAGE', { MESSAGE: 2, EXPERIENCE: 0, REACH: 0 }),
      'MESSAGE'
    )
  })

  it('clampFlagIndex resets out-of-range indexes to zero', () => {
    assert.equal(clampFlagIndex(0, 0), 0)
    assert.equal(clampFlagIndex(2, 3), 2)
    assert.equal(clampFlagIndex(3, 3), 0)
    assert.equal(clampFlagIndex(-1, 3), 0)
  })

  it('selects the demonstrated anonymous prompt without reordering the Fix List', () => {
    assert.equal(initialExplorerFlagIndex(FLAGS, 0, '3'), 2)
    assert.equal(initialExplorerFlagIndex(FLAGS, 1, 'missing'), 1)
  })

  it('opens the first worthwhile Flag instead of a leading Polish observation', () => {
    const polishFirst = [
      flag({ id: 'cookie', rubric: 'REACH', severity: 'POLISH' }),
      flag({ id: 'headline', rubric: 'MESSAGE', severity: 'IMPORTANT' }),
    ]
    assert.equal(initialExplorerFlagIndex(polishFirst, 0), 1)
    assert.equal(initialExplorerFlagIndex(polishFirst, 0, 'cookie'), 0)
    assert.equal(initialExplorerFlagIndex(polishFirst, 0), 1)
  })
})
