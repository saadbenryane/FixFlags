/** Progress milestones aligned to pipeline stages (not per-check bumps). */
export const PIPELINE_PROGRESS = {
  QUEUED: 5,
  CAPTURING: 20,
  CHECKING: 40,
  JUDGING: 70,
  FINALIZING: 90,
  /** Late FINALIZING after persist packaging; still before COMPLETED. */
  FINALIZING_PERSIST: 95,
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
  /** Deterministic checks started on the primary page; findings may stream from here. */
  CHECKS_STARTED: 42,
  /** Deterministic checks finished on pages, journey about to start (or skip). */
  CHECKS_DONE: 45,
  /** Deferred flow scan running (primary page only, full pipeline). */
  FLOW_RUNNING: 52,
  /** Journey Review started (Pro+). */
  JOURNEY_START: 48,
  /** Journey Review finished; AI judge about to start. */
  JOURNEY_DONE: 65,
} as const

/**
 * True when the progressive report may already show live deterministic
 * findings (checks have started on the primary page). The reduced teaser
 * pipeline streams exactly like the full pipeline from this anchor on, so
 * anonymous first scans get the same live feedback as signed-in checks.
 */
export function streamingFlagsVisible(
  status: string,
  progress: number | null | undefined
): boolean {
  if (status !== 'CHECKING' && status !== 'JUDGING' && status !== 'FINALIZING') return false
  return typeof progress === 'number' && progress >= PIPELINE_PROGRESS_SUBSTEP.CHECKS_STARTED
}
