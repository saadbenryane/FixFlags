import { describe, expect, it } from 'vitest'
import {
  PIPELINE_PROGRESS,
  PIPELINE_PROGRESS_SUBSTEP,
  streamingFlagsVisible,
} from '@/lib/audit/progress'

/**
 * Progressive flag streaming anchors: deterministic findings become visible on
 * the status payload once checks have started (CHECKS_STARTED) and are
 * persisted as modules complete (CHECKS_DONE). The reduced teaser pipeline
 * streams through the same anchors as the full pipeline.
 */

describe('PIPELINE_PROGRESS_SUBSTEP anchor ordering', () => {
  it('places CHECKS_STARTED between the CHECKING stage and CHECKS_DONE', () => {
    expect(PIPELINE_PROGRESS_SUBSTEP.CHECKS_STARTED).toBeGreaterThan(PIPELINE_PROGRESS.CHECKING)
    expect(PIPELINE_PROGRESS_SUBSTEP.CHECKS_STARTED).toBeLessThan(
      PIPELINE_PROGRESS_SUBSTEP.CHECKS_DONE
    )
    expect(PIPELINE_PROGRESS_SUBSTEP.CHECKS_DONE).toBeLessThan(
      PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START
    )
  })
})

describe('streamingFlagsVisible', () => {
  it('is false before checks start (QUEUED, CAPTURING, early CHECKING)', () => {
    expect(streamingFlagsVisible('QUEUED', PIPELINE_PROGRESS.QUEUED)).toBe(false)
    expect(streamingFlagsVisible('CAPTURING', PIPELINE_PROGRESS_SUBSTEP.CAPTURE_DONE)).toBe(false)
    expect(streamingFlagsVisible('CHECKING', PIPELINE_PROGRESS.CHECKING)).toBe(false)
  })

  it('is true once checks start and during JUDGING/FINALIZING', () => {
    expect(streamingFlagsVisible('CHECKING', PIPELINE_PROGRESS_SUBSTEP.CHECKS_STARTED)).toBe(true)
    expect(streamingFlagsVisible('CHECKING', PIPELINE_PROGRESS_SUBSTEP.CHECKS_DONE)).toBe(true)
    expect(streamingFlagsVisible('JUDGING', PIPELINE_PROGRESS.JUDGING)).toBe(true)
    expect(streamingFlagsVisible('FINALIZING', PIPELINE_PROGRESS.FINALIZING)).toBe(true)
  })

  it('never claims streaming on terminal or unknown statuses', () => {
    expect(streamingFlagsVisible('COMPLETED', 100)).toBe(false)
    expect(streamingFlagsVisible('FAILED', 100)).toBe(false)
    expect(streamingFlagsVisible('CHECKING', undefined)).toBe(false)
    expect(streamingFlagsVisible('CHECKING', null)).toBe(false)
  })
})
