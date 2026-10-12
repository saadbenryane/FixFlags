export type CheckAssertion = {
  key: string
  name: string
  expected: string
  observed: string
  passed: boolean
  disposition?: 'observed'
  complete?: boolean
  context?: string
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
