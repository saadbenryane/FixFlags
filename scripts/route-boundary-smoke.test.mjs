import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { boundaryStatusAllowed, boundaryResponseAllowed, concreteRoute, routeBoundaryProbe } from './route-boundary-smoke.mjs'

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
  const mcp = { boundary: 'api-key', file: 'app/api/mcp/route.ts' }
  assert.equal(boundaryStatusAllowed(mcp, 401), true)
  assert.equal(boundaryStatusAllowed(mcp, 404), false)
  assert.equal(boundaryStatusAllowed(mcp, 406), false)
  assert.equal(boundaryStatusAllowed(mcp, 200, 'DELETE'), false)
})

test('device issuance is checked without creating a production login challenge', async () => {
  const device = { boundary: 'public', file: 'app/api/cli/auth/device/route.ts' }
  assert.deepEqual(routeBoundaryProbe(device, 'POST'), { method: 'OPTIONS', status: 204, allow: 'POST' })
  assert.equal(await boundaryResponseAllowed(device, new Response(null, { status: 204, headers: { Allow: 'OPTIONS, POST' } }), 'POST'), true)
  assert.equal(await boundaryResponseAllowed(device, new Response(null, { status: 204, headers: { Allow: 'GET' } }), 'POST'), false)
  assert.equal(boundaryStatusAllowed(device, 201, 'POST'), false)
})

test('protocol validation checks the expected error rather than accepting arbitrary client errors or success', async () => {
  const token = { boundary: 'public', file: 'app/api/oauth/token/route.ts' }
  assert.equal(await boundaryResponseAllowed(token, Response.json({ error: 'invalid_request' }, { status: 400 }), 'POST'), true)
  assert.equal(await boundaryResponseAllowed(token, Response.json({ error: 'some_other_error' }, { status: 400 }), 'POST'), false)
  assert.equal(await boundaryResponseAllowed(token, Response.json({ access_token: 'unexpected' }), 'POST'), false)
})

test('MCP needs its credential challenge and callbacks must stay on the configured application origin', async () => {
  const mcp = { boundary: 'api-key', file: 'app/api/mcp/route.ts' }
  assert.equal(await boundaryResponseAllowed(mcp, Response.json({ error: { data: { code: 'MISSING_API_KEY' } } },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer resource_metadata="https://fixflags.com/.well-known/oauth-protected-resource"' } }), 'POST'), true)
  assert.equal(await boundaryResponseAllowed(mcp, Response.json({}, { status: 401 }), 'POST'), false)
  const callback = { boundary: 'session', file: 'app/api/sites/connections/google/callback/route.ts' }
  for (const [location, expected] of [['https://fixflags.com/sign-in?next=/dashboard', true],
    ['https://foreign.test/sign-in?next=/dashboard', false], ['https://fixflags.com/dashboard', false]]) {
    assert.equal(await boundaryResponseAllowed(callback, new Response(null, { status: 307, headers: { Location: location } }), 'GET', 'https://fixflags.com'), expected)
  }
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
        method: options.method, headers: options.headers, redirect: options.redirect }) + '\\n');
      if (url.pathname.startsWith('/api/health'))
        return Response.json({ ok: true, commit: 'a'.repeat(40) });
      const contract = routes.find(item => concreteRoute(item.file) === url.pathname);
      if (!contract) throw new Error('Unexpected fixture request');
      if (url.pathname === '/api/cli/auth/device') return new Response(null, { status: 204, headers: { Allow: 'OPTIONS, POST' } });
      if (url.pathname === '/api/cli/auth/token') return Response.json({ code: 'INVALID_REQUEST' }, { status: 400 });
      if (url.pathname === '/api/cli/release') return Response.json({ packageName: 'fixflags', version: 'fixture', available: false });
      if (['/api/oauth/authorize', '/api/oauth/token'].includes(url.pathname)) return Response.json({ error: 'invalid_request' }, { status: 400 });
      if (url.pathname === '/api/oauth/register') return Response.json({ error: 'invalid_client_metadata' }, { status: 400 });
      if (url.pathname === '/api/oauth/revoke') return new Response(null, { status: 200 });
      if (url.pathname === '/api/flags/missing/feedback') return Response.json({ code: 'INVALID_FEEDBACK' }, { status: 400 });
      if (url.pathname === '/api/shopify/session') return Response.json({ code: 'INTEGRATION_COMING_SOON' }, { status: 409 });
      if (url.pathname === '/api/sites/connections/google/callback') return new Response(null, { status: 307, headers: { Location: 'https://fixflags.com/sign-in?next=/dashboard' } });
      if (url.pathname === '/api/webhooks/railway') return Response.json({}, { status: 401 });
      if (url.pathname === '/api/mcp') return Response.json({ error: { data: { code: 'MISSING_API_KEY' } } }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer fixture' } });
      return Response.json({}, { status: contract.boundary === 'public' ? 200
        : contract.boundary === 'parked' ? 404 : contract.boundary === 'webhook' ? 400 : 401 });
    };
  `)
  try {
    const result = spawnSync(process.execPath, ['--import', preload, 'scripts/release-smoke.mjs'], {
      encoding: 'utf8', env: { ...process.env, PRODUCTION_URL: 'https://fixflags.com',
        RELEASE_EXPECTED_GIT_SHA: 'a'.repeat(40), RELEASE_SMOKE_ADMIN_COOKIE: authorized ? 'fixture-session=secret' : '',
        RELEASE_SMOKE_BEARER: 'fixture-bearer-secret', RELEASE_SMOKE_EVIDENCE_FILE: '' },
    })
    const calls = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    const paid = calls.filter(call => call.path === '/api/health/ai?validate=1')
    if (authorized) {
      assert.equal(result.status, 0, result.stderr)
      assert.equal(paid.length, 1)
      assert.deepEqual(paid[0].headers, { authorization: 'Bearer fixture-bearer-secret', cookie: 'fixture-session=secret', origin: 'https://fixflags.com' })
      assert.equal(paid[0].redirect, 'error')
    } else {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /RELEASE_SMOKE_ADMIN_COOKIE is required/)
      assert.equal(paid.length, 0)
    }
    assert.ok(calls.filter(call => call.path !== '/api/health/ai?validate=1').every(call => !call.headers.cookie))
    assert.ok(calls.filter(call => !call.path.startsWith('/api/health')).every(call => !call.headers.authorization))
    assert.ok(calls.filter(call => call.path === '/api/cli/auth/device').every(call => call.method === 'OPTIONS'))
    assert.ok(!result.stdout.includes('fixture-session=secret'))
    assert.ok(!result.stderr.includes('fixture-session=secret'))
    assert.ok(!result.stdout.includes('fixture-bearer-secret'))
    assert.ok(!result.stderr.includes('fixture-bearer-secret'))
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
