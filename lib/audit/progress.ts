/** Progress milestones aligned to pipeline stages (not per-check bumps). */
export const AUDIT_PROGRESS = {
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
export const AUDIT_PROGRESS_SUBSTEP = {
  /** Capture + PageSpeed finished, checks about to start. */
  CAPTURE_DONE: 32,
  /** Deterministic checks finished, AI judge about to start. */
  CHECKS_DONE: 58,
} as const
