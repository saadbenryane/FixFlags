/** Pipeline version, bump when audit logic changes materially. */
export const PIPELINE_VERSION = '2.1.0'

/**
 * Hard end-to-end deadline for a single audit run (ms). Real sites can spend
 * ~30s in PageSpeed plus screenshot capture and a 20s flow scan, so 90s was too
 * tight and force-failed legitimate runs ("took longer than expected"). 180s
 * leaves headroom while still capping genuinely stuck audits. The BullMQ job
 * lock (AUDIT_DEADLINE_MS + 30s) scales with this.
 */
export const AUDIT_DEADLINE_MS = 180_000

/**
 * Budget reserved at the end of a run for persisting results and finalizing, so
 * the judge (the longest late-stage step) is never allowed to consume the whole
 * window and force a timeout right before completion.
 */
export const FINALIZE_RESERVE_MS = 10_000

/**
 * Minimum time that must remain before the AI judge is started. If less than
 * this is left, the judge is skipped and the audit finalizes with deterministic
 * results (graceful degradation), rather than starting a call it cannot finish.
 */
export const MIN_JUDGE_BUDGET_MS = 25_000

/** Cron threshold before an in-progress audit is considered stuck. */
export const STUCK_AUDIT_MINUTES = 15
