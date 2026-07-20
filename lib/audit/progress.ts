/** Progress milestones aligned to pipeline stages (not per-check bumps). */
export const PIPELINE_PROGRESS = {
  QUEUED: 5,
  CAPTURING: 20,
  CHECKING: 40,
  JUDGING: 70,
  FINALIZING: 90,
  COMPLETED: 100,
} as const

/**
 * Intermediate progress values written mid-stage so the ring keeps advancing
 * within a phase (capture and checks are the longest steps). These sit between
 * the stage anchors above and never move the status enum on their own.
 */
export const PIPELINE_PROGRESS_SUBSTEP = {
  /** Capture + PageSpeed finished, checks about to start. */
  CAPTURE_DONE: 32,
  /** Deterministic checks finished on pages, journey about to start (or skip). */
  CHECKS_DONE: 45,
  /** Journey Review started (Pro+). */
  JOURNEY_START: 48,
  /** Journey Review finished; AI judge about to start. */
  JOURNEY_DONE: 65,
} as const