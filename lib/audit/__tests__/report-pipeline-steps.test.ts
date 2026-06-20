import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import {
  buildPipelineSteps,
  buildRubricScoreRows,
} from '@/lib/audit/report-pipeline-steps'

describe('buildPipelineSteps', () => {
  it('marks flags step active in sample mode when flags exist', () => {
    const steps = buildPipelineSteps({ flagCount: 3, pageType: 'Landing page', mode: 'sample' })
    const flagsStep = steps.find((s) => s.id === 'flags')
    assert.equal(flagsStep?.state, 'active')
    assert.equal(flagsStep?.detail, '3')
    const promptsStep = steps.find((s) => s.id === 'prompts')
    assert.equal(promptsStep?.state, 'pending')
  })

  it('marks audit prompts and review from hasFixPrompts and reviewReady', () => {
    const incomplete = buildPipelineSteps({
      flagCount: 2,
      pageType: 'Landing page',
      mode: 'audit',
      hasFixPrompts: false,
      reviewReady: false,
    })
    assert.equal(incomplete.find((s) => s.id === 'prompts')?.state, 'pending')
    assert.equal(incomplete.find((s) => s.id === 'ready')?.state, 'pending')

    const complete = buildPipelineSteps({
      flagCount: 2,
      pageType: 'Landing page',
      mode: 'audit',
      hasFixPrompts: true,
      reviewReady: true,
    })
    assert.equal(complete.find((s) => s.id === 'flags')?.state, 'done')
    assert.equal(complete.find((s) => s.id === 'prompts')?.state, 'done')
    assert.equal(complete.find((s) => s.id === 'ready')?.state, 'done')
  })

  it('uses CHECK_ID_COUNT in checks step detail', () => {
    const steps = buildPipelineSteps({ flagCount: 0, pageType: null, mode: 'sample' })
    const checksStep = steps.find((s) => s.id === 'checks')
    assert.equal(checksStep?.detail, `${CHECK_ID_COUNT} checks`)
    const captureStep = steps.find((s) => s.id === 'capture')
    assert.equal(captureStep?.detail, 'Landing page')
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
