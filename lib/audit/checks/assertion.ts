export type CheckAssertion = {
  key: string
  name: string
  expected: string
  observed: string
  passed: boolean
  complete?: boolean
  context?: string
  targets?: Array<{ selector: string; label: string; context?: string }>
}
