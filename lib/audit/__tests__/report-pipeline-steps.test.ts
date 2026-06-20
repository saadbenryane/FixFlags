import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import {
  buildPipelineSteps,
  buildRubricScoreRows,
  reportScanDetail,
} from '@/lib/audit/report-pipeline-steps'

describe('buildPipelineSteps', () => {
  it('uses three value steps: Scan, Flag, Fix', () => {
    const steps = buildPipelineSteps({ flagCount: 3, pageType: 'Landing page', mode: 'sample' })
    assert.deepEqual(
      steps.map((s) => s.label),
      ['Scan', 'Flag', 'Fix']
    )
  })

  it('marks Flag active in sample mode when flags exist', () => {
    const steps = buildPipelineSteps({ flagCount: 3, pageType: 'Landing page', mode: 'sample' })
    const flagsStep = steps.find((s) => s.id === 'flags')
    assert.equal(flagsStep?.state, 'active')
    assert.equal(flagsStep?.detail, '3')
    const fixStep = steps.find((s) => s.id === 'prompts')
    assert.equal(fixStep?.state, 'pending')
  })

  it('marks Fix done on audit when fix prompts exist', () => {
    const incomplete = buildPipelineSteps({
      flagCount: 2,
      pageType: 'Landing page',
      mode: 'audit',
      hasFixPrompts: false,
    })
    assert.equal(incomplete.find((s) => s.id === 'prompts')?.state, 'pending')

    const complete = buildPipelineSteps({
      flagCount: 2,
      pageType: 'Landing page',
      mode: 'audit',
      hasFixPrompts: true,
    })
    assert.equal(complete.find((s) => s.id === 'flags')?.state, 'done')
    assert.equal(complete.find((s) => s.id === 'prompts')?.state, 'done')
  })

  it('puts page type or check count on Scan step detail', () => {
    const withType = buildPipelineSteps({ flagCount: 0, pageType: 'Landing page', mode: 'sample' })
    assert.equal(withType.find((s) => s.id === 'scan')?.detail, 'Landing page')

    const fallback = buildPipelineSteps({ flagCount: 0, pageType: null, mode: 'sample' })
    assert.equal(fallback.find((s) => s.id === 'scan')?.detail, `${CHECK_ID_COUNT} checks`)
  })
})

describe('reportScanDetail', () => {
  it('returns page type or check count fallback', () => {
    assert.equal(reportScanDetail('Landing page'), 'Landing page')
    assert.equal(reportScanDetail(null), `${CHECK_ID_COUNT} checks`)
  })
})

describe('buildRubricScoreRows', () => {
  it('orders rubrics MESSAGE, EXPERIENCE, REACH with labels', () => {
    const rows = buildRubricScoreRows([
      { name: 'REACH', score: 10, grade: 'F' },
      { name: 'MESSAGE', score: 100, grade: 'A' },
      { name: 'EXPERIENCE', score: 75, grade: 'C' },
    ])
    assert.deepEqual(
      rows.map((r) => r.name),
      ['Message', 'Experience', 'Reach']
    )
    assert.equal(rows[0].score, 100)
    assert.equal(rows[1].score, 75)
    assert.equal(rows[2].score, 10)
  })

  it('derives grade from score when grade missing', () => {
    const rows = buildRubricScoreRows([{ name: 'MESSAGE', score: 95, grade: null }])
    assert.equal(rows[0].grade, 'A')
  })
})
