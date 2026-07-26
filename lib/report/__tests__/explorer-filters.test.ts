import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  clampFlagIndex,
  countFlagsByRubric,
  filterExplorerFlags,
  initialExplorerFlagIndex,
  pageFilterLabel,
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
    evidenceDevices: ['desktop'],
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
  it('pageFilterLabel prefers path segment then role', () => {
    assert.equal(pageFilterLabel('https://ex.com/', 'Homepage'), 'Homepage')
    assert.equal(pageFilterLabel('https://ex.com/pricing', 'Pricing'), 'pricing')
    assert.equal(pageFilterLabel('not-a-url', 'Fallback'), 'Fallback')
  })

  it('countFlagsByRubric respects page filters', () => {
    assert.deepEqual(countFlagsByRubric(FLAGS), {
      MESSAGE: 2,
      EXPERIENCE: 1,
      REACH: 1,
    })
    assert.deepEqual(countFlagsByRubric(FLAGS, { pageFilter: 'https://ex.com/pricing' }), {
      MESSAGE: 1,
      EXPERIENCE: 0,
      REACH: 1,
    })
  })

  it('filterExplorerFlags combines rubric, page, severity, and impact', () => {
    const filtered = filterExplorerFlags(FLAGS, {
      rubricFilter: 'MESSAGE',
      pageFilter: 'https://ex.com/pricing',
      severityFilter: 'IMPORTANT',
      impactFilter: 'TRUST',
    })
    assert.deepEqual(
      filtered.map((f) => f.id),
      ['2']
    )
  })

  it('keeps one consolidated fix discoverable from every affected page', () => {
    const shared = flag({
      id: 'shared',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      pageUrls: ['https://ex.com/', 'https://ex.com/pricing'],
      occurrenceCount: 2,
    })

    assert.equal(
      filterExplorerFlags([shared], { pageFilter: 'https://ex.com/' }).length,
      1
    )
    assert.equal(
      filterExplorerFlags([shared], { pageFilter: 'https://ex.com/pricing' }).length,
      1
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
})
