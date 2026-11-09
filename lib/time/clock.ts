export interface Clock {
  now(): Date
}

export const systemClock: Clock = {
  now: () => new Date(),
}

export function fixedClock(now: Date): Clock {
  const instant = new Date(now)
  return { now: () => new Date(instant) }
}

/** Advance a persisted attempt marker even if the wall clock has not moved. */
export function nextAttemptTimestamp(now: Date, previous: Date | null): Date {
  return previous ? new Date(Math.max(now.getTime(), previous.getTime() + 1)) : now
}
