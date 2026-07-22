export type RouteContractCase =
  | 'unauthenticated'
  | 'invalid-input'
  | 'forbidden'
  | 'plan-gated'
  | 'not-found'
  | 'conflict'
  | 'success'
  | 'dependency-failure'

export type RouteSecurityBoundary = 'public' | 'session' | 'admin' | 'secret' | 'webhook'

export interface RouteContract {
  file: string
  methods: string[]
  boundary: RouteSecurityBoundary
  cases: RouteContractCase[]
}
