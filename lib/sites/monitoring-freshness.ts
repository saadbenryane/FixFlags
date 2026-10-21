/** Admission checks due work frequently; the customer's cadence stays on the Site. */
export const MONITORING_SWEEP_INTERVAL_MS = 30_000
/** Keep lateness tolerance independent of the scheduler's polling frequency. */
export const MONITORING_OVERDUE_GRACE_MS = 5 * 60_000

export function monitoringOverdueBefore(now: Date): Date {
  return new Date(now.getTime() - MONITORING_OVERDUE_GRACE_MS)
}

export function monitoringIsOverdue(nextRunAt: Date | string, now: Date): boolean {
  const dueAt = nextRunAt instanceof Date ? nextRunAt.getTime() : Date.parse(nextRunAt)
  return !Number.isFinite(dueAt) || dueAt < monitoringOverdueBefore(now).getTime()
}
