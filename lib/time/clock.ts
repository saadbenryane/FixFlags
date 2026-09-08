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
