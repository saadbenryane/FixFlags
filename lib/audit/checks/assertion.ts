export const CHECK_OBSERVATION_REASONS = ['tracking_no_library', 'tracking_no_event', 'tracking_suppressed', 'tracking_provider_unverified'] as const
export type CheckObservationReason = typeof CHECK_OBSERVATION_REASONS[number]

export type CheckAssertion = {
  reason?: CheckObservationReason
  key: string
  name: string
  expected: string
  observed: string
  passed: boolean
  disposition?: 'observed'
  complete?: boolean
  context?: string
  /** Individually measured scopes within an aggregate assertion. Missing scopes are absent. */
  measurements?: Array<{ context: string; passed: boolean; observed: string }>
  targets?: Array<{ selector: string; label: string; context?: string }>
}

export type CheckRecorder = (assertion: CheckAssertion) => void

/** Undefined evidence remains incomplete. Advisory observations cannot certify a repair. */
export function recordObservation(
  record: CheckRecorder | undefined,
  key: string,
  name: string,
  expected: string,
  observed: string,
  passed: boolean | undefined,
  advisory = false,
): void {
  record?.({ key, name, expected, observed: observed.slice(0, 2000),
    passed: passed === true, complete: passed !== undefined,
    ...(advisory ? { disposition: 'observed' as const } : {}) })
}
