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
