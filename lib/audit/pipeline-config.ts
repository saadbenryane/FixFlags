/** Pipeline version, bump when audit logic changes materially. */
export const PIPELINE_VERSION = '2.4.0'

/**
 * Hard end-to-end deadline for a single audit run (ms). Real sites can spend
 * ~30s in PageSpeed plus screenshot capture and a 20s flow scan, so 90s was too
 * tight and force-failed legitimate runs ("took longer than expected"). 300s
 * leaves headroom while still capping genuinely stuck audits. The BullMQ job
 * lock (AUDIT_DEADLINE_MS + 30s) scales with this.
 * Override via AUDIT_DEADLINE_MS env var.
 */
export const AUDIT_DEADLINE_MS = Number(process.env.AUDIT_DEADLINE_MS ?? 300_000)

/**
 * Budget reserved at the end of a run for persisting results and finalizing, so
 * the judge (the longest late-stage step) is never allowed to consume the whole
 * window and force a timeout right before completion.
 * Override via FINALIZE_RESERVE_MS env var.
 */
export const FINALIZE_RESERVE_MS = Number(process.env.FINALIZE_RESERVE_MS ?? 10_000)

/**
 * Minimum time that must remain before the AI judge is started. If less than
 * this is left, the judge is skipped and the audit finalizes with deterministic
 * results (graceful degradation), rather than starting a call it cannot finish.
 * Override via MIN_JUDGE_BUDGET_MS env var.
 */
export const MIN_JUDGE_BUDGET_MS = Number(process.env.MIN_JUDGE_BUDGET_MS ?? 25_000)

/** Minimum remaining audit time before starting slow 3G replay on the primary page. */
export const SLOW_REPLAY_MIN_BUDGET_MS = Number(process.env.SLOW_REPLAY_MIN_BUDGET_MS ?? 30_000)

/** Cron threshold before an in-progress audit is considered stuck. Override via STUCK_AUDIT_MINUTES env var. */
export const STUCK_AUDIT_MINUTES = Number(process.env.STUCK_AUDIT_MINUTES ?? 20)
