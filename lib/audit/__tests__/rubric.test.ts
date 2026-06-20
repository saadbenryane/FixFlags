import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  buildRubricInput,
  computeShareStatusFromRubrics,
  computeRubricsFromRows,
  computeRubricStatus,
  computeAllRubricStatuses,
  computeShareStatus,
  type RubricInput,
  type RubricComputed,
} from '@/lib/audit/rubric'
import { RUBRIC_ORDER } from '@/lib/audit/constants'

function rubric(name: string, grade: string | null, severity?: string): RubricInput {
  return {
    name,
    grade,
    score: grade === 'F' ? 30 : grade === 'D' ? 50 : grade === 'C' ? 65 : grade === 'B' ? 80 : grade === 'A' ? 95 : null,
    flags: severity ? [{ severity }] : [],
  }
}

describe('buildRubricInput', () => {
  it('merges flat flags into per-rubric input', () => {
    const input = buildRubricInput(
      [{ name: 'REACH', grade: 'B', score: 80 }],
      [{ severity: 'CRITICAL', rubric: 'REACH' }]
    )
    assert.equal(input.length, 1)
    assert.equal(input[0].flags?.[0]?.severity, 'CRITICAL')
    const rubrics = computeAllRubricStatuses(input)
    const reach = rubrics.find((r) => r.name === 'REACH')
    assert.equal(reach?.status, 'BLOCKED')
  })

  it('matches computeRubricsFromRows with nested flags', () => {
    const rows = [
      {
        name: 'EXPERIENCE',
        grade: 'B',
        score: 80,
        flags: [{ severity: 'CRITICAL' }],
      },
    ]
    const fromNested = computeRubricsFromRows(rows)
    const fromFlat = computeRubricsFromRows(
      [{ name: 'EXPERIENCE', grade: 'B', score: 80 }],
      [{ severity: 'CRITICAL', rubric: 'EXPERIENCE' }]
    )
    assert.deepEqual(fromNested, fromFlat)
    assert.equal(
      computeShareStatusFromRubrics(rows),
      computeShareStatusFromRubrics(
        [{ name: 'EXPERIENCE', grade: 'B', score: 80 }],
        [{ severity: 'CRITICAL', rubric: 'EXPERIENCE' }]
      )
    )
  })
})

describe('computeRubricStatus', () => {
  it('returns PASS when grade is B or above with no flags', () => {
    assert.equal(computeRubricStatus(rubric('MESSAGE', 'B')), 'PASS')
  })

  it('returns NEEDS_ATTENTION when grade is C', () => {
    assert.equal(computeRubricStatus(rubric('MESSAGE', 'C')), 'NEEDS_ATTENTION')
  })

  it('returns BLOCKED when grade is F', () => {
    assert.equal(computeRubricStatus(rubric('MESSAGE', 'F')), 'BLOCKED')
  })

  it('returns BLOCKED when a CRITICAL flag exists', () => {
    assert.equal(computeRubricStatus(rubric('MESSAGE', 'B', 'CRITICAL')), 'BLOCKED')
  })

  it('returns NEEDS_ATTENTION when an IMPORTANT flag exists', () => {
    assert.equal(computeRubricStatus(rubric('MESSAGE', 'B', 'IMPORTANT')), 'NEEDS_ATTENTION')
  })
})

describe('computeAllRubricStatuses', () => {
  it('returns all three rubrics', () => {
    const input = RUBRIC_ORDER.map((name) => rubric(name, 'A'))
    const result = computeAllRubricStatuses(input)
    assert.equal(result.length, 3)
    for (const item of result) {
      assert.ok(RUBRIC_ORDER.includes(item.name))
    }
  })

  it('counts critical and important flags per rubric', () => {
    const input = [
      rubric('MESSAGE', 'B', 'CRITICAL'),
      rubric('EXPERIENCE', 'A', 'IMPORTANT'),
      rubric('REACH', 'B'),
    ]
    const result = computeAllRubricStatuses(input)
    const message = result.find((r) => r.name === 'MESSAGE')
    assert.equal(message?.criticalCount, 1)
    const experience = result.find((r) => r.name === 'EXPERIENCE')
    assert.equal(experience?.importantCount, 1)
  })
})

describe('computeShareStatus', () => {
  function computed(status: string, criticalCount = 0): RubricComputed {
    return {
      name: 'MESSAGE',
      status: status as RubricComputed['status'],
      flagCount: 0,
      criticalCount,
      importantCount: 0,
    }
  }

  it('returns good_to_share when no critical flags', () => {
    assert.equal(
      computeShareStatus([
        computed('PASS'),
        computed('PASS'),
        computed('NEEDS_ATTENTION'),
      ]),
      'good_to_share'
    )
  })

  it('returns fix_before_sharing when any rubric has critical flags', () => {
    assert.equal(
      computeShareStatus([
        computed('PASS'),
        computed('NEEDS_ATTENTION', 1),
        computed('PASS'),
      ]),
      'fix_before_sharing'
    )
  })

  it('returns good_to_share when rubric is blocked without critical flags', () => {
    assert.equal(
      computeShareStatus([
        computed('PASS'),
        computed('BLOCKED'),
        computed('PASS'),
      ]),
      'good_to_share'
    )
  })
})
