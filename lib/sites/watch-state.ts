export type WatchBoardState = 'off' | 'watching' | 'paused' | 'delayed' | 'quota'

export function watchBoardState(input: {
  interval: 'weekly' | 'daily' | null
  nextRunAt: Date | string | null
  lastError: string | null
  consecutiveFailures: number
}): WatchBoardState {
  const nextRunAt = input.nextRunAt
  const error = input.lastError ?? ''
  const quota = /allowance|quota|upgrade/i.test(error)

  if (input.interval && !nextRunAt) return 'paused'
  if (quota && input.interval) return 'quota'
  if (input.consecutiveFailures > 0 || (error && input.interval && nextRunAt)) return 'delayed'
  if (input.interval && nextRunAt) return 'watching'
  return 'off'
}

export function watchBoardLabel(state: WatchBoardState, interval: 'weekly' | 'daily' | null): string {
  if (state === 'watching') {
    return interval === 'daily' ? 'Watching daily' : 'Watching weekly'
  }
  if (state === 'paused') return 'Watch paused'
  if (state === 'delayed') return 'Watch delayed'
  if (state === 'quota') return 'Watch waiting on quota'
  return 'Not watching'
}

/** True only after a successful schedule write (interval + next run). */
export function watchIsCovered(state: WatchBoardState): boolean {
  return state === 'watching'
}
