import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  clampFlagIndex,
  countFlagsByRubric,
  filterExplorerFlags,
  pageFilterLabel,
  priorityLabelForIndex,
  resolveRubricFilter,
} from '@/lib/report/explorer-filters'
import type { ExplorerFlag } from '@/lib/report/explorer-model'

function flag(
  partial: Partial<ExplorerFlag> & Pick<ExplorerFlag, 'id' | 'rubric' | 'severity'>
): ExplorerFlag {
  return {
    title: 'Problem',
    checkId: null,
    priorityLabel: 'Next',
    rubricLabel: partial.rubric,
    severityLabel: partial.severity,
    impactTag: null,
    whyItMatters: '',
    evidence: '',
    fixPrompt: '',
    copyFixPrompt: '',
    toolPrompts: {},
    verificationRule: null,
    evidenceDevices: ['desktop'],
    hasFixPrompt: false,
    pageUrl: null,
    truthLabel: 'Detected',
    ...partial,
  }
}

const FLAGS: ExplorerFlag[] = [
  flag({ id: '1', rubric: 'MESSAGE', severity: 'CRITICAL', pageUrl: 'https://ex.com/' }),
  flag({ id: '2', rubric: 'MESSAGE', severity: 'IMPORTANT', pageUrl: 'https://ex.com/pricing' }),
  flag({ id: '3', rubric: 'EXPERIENCE', severity: 'CRITICAL', pageUrl: 'https://ex.com/' }),
  flag({ id: '4', rubric: 'REACH', severity: 'POLISH', pageUrl: 'https://ex.com/pricing' }),
]

describe('explorer-filters', () => {
  it('priorityLabelForIndex returns fix-first language', () => {
    assert.equal(priorityLabelForIndex(0), 'Top fix')
    assert.equal(priorityLabelForIndex(1), 'Next')
    assert.equal(priorityLabelForIndex(2), 'Priority 3')
  })

  it('pageFilterLabel prefers path segment then role', () => {
    assert.equal(pageFilterLabel('https://ex.com/', 'Homepage'), 'Homepage')
    assert.equal(pageFilterLabel('https://ex.com/pricing', 'Pricing'), 'pricing')
    assert.equal(pageFilterLabel('not-a-url', 'Fallback'), 'Fallback')
  })

  it('countFlagsByRubric respects severity and page filters', () => {
    assert.deepEqual(countFlagsByRubric(FLAGS), {
      MESSAGE: 2,
      EXPERIENCE: 1,
      REACH: 1,
    })
    assert.deepEqual(countFlagsByRubric(FLAGS, { severityFilter: 'CRITICAL' }), {
      MESSAGE: 1,
      EXPERIENCE: 1,
      REACH: 0,
    })
    assert.deepEqual(countFlagsByRubric(FLAGS, { pageFilter: 'https://ex.com/pricing' }), {
      MESSAGE: 1,
      EXPERIENCE: 0,
      REACH: 1,
    })
  })

  it('filterExplorerFlags combines severity, rubric, and page', () => {
    const filtered = filterExplorerFlags(FLAGS, {
      severityFilter: 'CRITICAL',
      rubricFilter: 'MESSAGE',
      pageFilter: 'https://ex.com/',
    })
    assert.deepEqual(
      filtered.map((f) => f.id),
      ['1']
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
})
