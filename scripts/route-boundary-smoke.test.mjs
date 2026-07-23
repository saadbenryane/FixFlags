import test from 'node:test'
import assert from 'node:assert/strict'
import { boundaryStatusAllowed, concreteRoute } from './route-boundary-smoke.mjs'

test('concreteRoute resolves dynamic API paths without changing the public boundary', () => {
  assert.equal(
    concreteRoute('app/api/reports/[id]/share-links/route.ts'),
    '/api/reports/missing/share-links',
  )
  assert.equal(concreteRoute('app/api/badge/[url]/route.ts'), '/api/badge/https%3A%2F%2Fexample.com')
})

test('boundaryStatusAllowed rejects protected success and unexpected server failures', () => {
  const session = { boundary: 'session', file: 'app/api/projects/route.ts' }
  const health = { boundary: 'public', file: 'app/api/health/ready/route.ts' }
  assert.equal(boundaryStatusAllowed(session, 401), true)
  assert.equal(boundaryStatusAllowed(session, 200), false)
  assert.equal(boundaryStatusAllowed(session, 500), false)
  assert.equal(boundaryStatusAllowed(health, 503), true)
})
