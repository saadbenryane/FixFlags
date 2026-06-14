/** Pipeline version — bump when audit logic changes materially. */
export const PIPELINE_VERSION = '2.0.0'

/** Hard end-to-end deadline for a single audit run (ms). */
export const AUDIT_DEADLINE_MS = 90_000

/** Cron threshold before an in-progress audit is considered stuck. */
export const STUCK_AUDIT_MINUTES = 15
