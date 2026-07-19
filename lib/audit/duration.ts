export function durationFromTimestamps(
  durationMs?: number | null,
  startedAt?: string | Date | null,
  completedAt?: string | Date | null
): number | null {
  if (durationMs != null) {
    return Math.round(durationMs / 1000)
  }
  if (startedAt && completedAt) {
    return Math.round(
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
    )
  }
  return null
}
