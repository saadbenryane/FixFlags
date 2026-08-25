import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('boundaryStatusAllowed handles route-specific exceptions', () => {
  const shareLinks = { boundary: 'session', file: 'app/api/reports/[id]/share-links/route.ts' }
  const mcp = { boundary: 'mcp', file: 'app/api/mcp/route.ts' }
  assert.equal(boundaryStatusAllowed(shareLinks, 400), true)
  assert.equal(boundaryStatusAllowed(shareLinks, 404), true)
  assert.equal(boundaryStatusAllowed(mcp, 406), true)
  assert.equal(boundaryStatusAllowed(mcp, 200, 'DELETE'), true)
  assert.equal(boundaryStatusAllowed(mcp, 401, 'DELETE'), true)
})

test('deployed release smoke executes the complete generated route inventory', () => {
  const releaseSmoke = readFileSync('scripts/release-smoke.mjs', 'utf8')
  assert.match(releaseSmoke, /runRouteBoundarySmoke/)
  assert.match(releaseSmoke, /PRODUCTION_URL/)
  assert.match(releaseSmoke, /RELEASE_EXPECTED_GIT_SHA/)
  assert.match(releaseSmoke, /probe\('\/api\/health', 'deployed revision'\)/)
  assert.match(releaseSmoke, /running .* does not exactly match candidate/)
  assert.match(releaseSmoke, /RELEASE_SMOKE_EVIDENCE_FILE/)
  assert.match(releaseSmoke, /runningCommit: health\.commit/)
})
