import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { getStagePresentation, getProgressPercent } from '@/lib/audit/progress-ui'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { PIPELINE_PROGRESS, PIPELINE_PROGRESS_SUBSTEP } from '@/lib/audit/progress'

describe('getStagePresentation', () => {
  it('maps each pipeline status to a stable stage label', () => {
    for (const stage of AUDIT_PROGRESS.stages) {
      const presentation = getStagePresentation(stage.status)
      assert.equal(presentation.label, stage.label)
      assert.equal(presentation.scanningLabel, stage.label)
      assert.equal(presentation.detail, stage.subtitle)
      assert.match(presentation.statusLine, new RegExp(`Step \\d+ of ${AUDIT_PROGRESS.stages.length}`))
    }
  })

  it('does not rotate copy on a tick — same inputs yield same output', () => {
    const a = getStagePresentation('CHECKING', 40)
    const b = getStagePresentation('CHECKING', 40)
    assert.deepEqual(a, b)
  })

  it('uses real CHECKING substeps only when progress crosses anchors', () => {
    assert.equal(
      getStagePresentation('CHECKING', PIPELINE_PROGRESS.CHECKING).detail,
      AUDIT_PROGRESS.stages.find((s) => s.status === 'CHECKING')?.subtitle
    )
    assert.equal(
      getStagePresentation('CHECKING', PIPELINE_PROGRESS_SUBSTEP.CHECKS_DONE).detail,
      AUDIT_PROGRESS.substeps.CHECKS_DONE
    )
    assert.equal(
      getStagePresentation('CHECKING', PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START).detail,
      AUDIT_PROGRESS.substeps.JOURNEY_START
    )
  })

  it('does not leak journey substeps into late JUDGING', () => {
    const presentation = getStagePresentation('JUDGING', PIPELINE_PROGRESS.JUDGING)
    assert.equal(presentation.detail, AUDIT_PROGRESS.stages.find((s) => s.status === 'JUDGING')?.subtitle)
    assert.equal(presentation.scanningLabel, 'AI review')
  })

  it('surfaces journey substeps while status is JUDGING but progress is still in the journey band', () => {
    assert.equal(
      getStagePresentation('JUDGING', PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START).detail,
      AUDIT_PROGRESS.substeps.JOURNEY_START
    )
    assert.equal(
      getStagePresentation('JUDGING', PIPELINE_PROGRESS_SUBSTEP.JOURNEY_DONE).detail,
      AUDIT_PROGRESS.substeps.JOURNEY_DONE
    )
  })

  it('falls back to QUEUED presentation for unknown status', () => {
    const presentation = getStagePresentation('SOMETHING_ELSE')
    assert.equal(presentation.label, AUDIT_PROGRESS.stages[0].label)
  })
})

describe('getProgressPercent', () => {
  it('prefers explicit progress over stage fallback', () => {
    assert.equal(getProgressPercent(55, 'CHECKING'), 55)
  })

  it('uses PIPELINE_PROGRESS when progress is missing', () => {
    assert.equal(getProgressPercent(null, 'CAPTURING'), PIPELINE_PROGRESS.CAPTURING)
  })
})
