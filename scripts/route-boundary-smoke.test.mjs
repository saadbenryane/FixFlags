import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { boundaryStatusAllowed, concreteRoute } from './route-boundary-smoke.mjs'

test('concreteRoute resolves dynamic API paths without changing the public boundary', () => {
  assert.equal(
    concreteRoute('app/api/reports/[id]/chat/route.ts'),
    '/api/reports/missing/chat',
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
  const mcp = { boundary: 'parked', file: 'app/api/mcp/route.ts' }
  assert.equal(boundaryStatusAllowed(mcp, 404), true)
  assert.equal(boundaryStatusAllowed(mcp, 406), false)
  assert.equal(boundaryStatusAllowed(mcp, 200, 'DELETE'), false)
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

for (const authorized of [false, true]) test(`release smoke confines administrator credentials to live validation (authorized: ${authorized})`, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fixflags-smoke-auth-'))
  const observations = path.join(directory, 'requests.jsonl')
  const preload = path.join(directory, 'transport.mjs')
  const registry = pathToFileURL(path.resolve('scripts/route-contract-registry.mjs')).href
  const smoke = pathToFileURL(path.resolve('scripts/route-boundary-smoke.mjs')).href
  writeFileSync(preload, `
    import { appendFileSync } from 'node:fs';
    import { collectRouteContracts } from ${JSON.stringify(registry)};
    import { concreteRoute } from ${JSON.stringify(smoke)};
    const routes = collectRouteContracts();
    globalThis.fetch = async (input, options) => {
      const url = new URL(input);
      appendFileSync(${JSON.stringify(observations)}, JSON.stringify({ path: url.pathname + url.search,
        headers: options.headers, redirect: options.redirect }) + '\\n');
      if (url.pathname.startsWith('/api/health'))
        return Response.json({ ok: true, commit: 'a'.repeat(40) });
      const contract = routes.find(item => concreteRoute(item.file) === url.pathname);
      if (!contract) throw new Error('Unexpected fixture request');
      return Response.json({}, { status: contract.boundary === 'public' ? 200
        : contract.boundary === 'parked' ? 404 : contract.boundary === 'webhook' ? 400 : 401 });
    };
  `)
  try {
    const result = spawnSync(process.execPath, ['--import', preload, 'scripts/release-smoke.mjs'], {
      encoding: 'utf8', env: { ...process.env, PRODUCTION_URL: 'https://fixflags.com',
        RELEASE_EXPECTED_GIT_SHA: 'a'.repeat(40), RELEASE_SMOKE_ADMIN_COOKIE: authorized ? 'fixture-session=secret' : '',
        RELEASE_SMOKE_BEARER: '', RELEASE_SMOKE_EVIDENCE_FILE: '' },
    })
    const calls = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    const paid = calls.filter(call => call.path === '/api/health/ai?validate=1')
    if (authorized) {
      assert.equal(result.status, 0, result.stderr)
      assert.equal(paid.length, 1)
      assert.deepEqual(paid[0].headers, { cookie: 'fixture-session=secret', origin: 'https://fixflags.com' })
      assert.equal(paid[0].redirect, 'error')
    } else {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /RELEASE_SMOKE_ADMIN_COOKIE is required/)
      assert.equal(paid.length, 0)
    }
    assert.ok(calls.filter(call => call.path !== '/api/health/ai?validate=1').every(call => !call.headers.cookie))
    assert.ok(!result.stdout.includes('fixture-session=secret'))
    assert.ok(!result.stderr.includes('fixture-session=secret'))
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
