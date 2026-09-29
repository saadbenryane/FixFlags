import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GATED_MCP_DISCOVERY_PREFIXES,
  PARKED_PUBLIC_PREFIXES,
  powerToolVisibilityFailures,
} from './power-tools-visibility-guard.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parkedProxy() {
  return `const PARKED = ${JSON.stringify(PARKED_PUBLIC_PREFIXES)}\nreturn new Response(null, { status: 404 })`
}

/** The real gate module, because the point of these tests is what the repo actually does. */
function mcpGate() {
  return readFileSync(path.join(root, 'lib/mcp/discoverability.ts'), 'utf8')
}

function proxyHonouringGate() {
  return `${parkedProxy()}\nimport { isMcpDiscoveryPath } from '@/lib/mcp/discoverability'\nisMcpDiscoveryPath(pathname)`
}

test('accepts retained implementations when every public prefix is parked and undiscoverable', () => {
  assert.deepEqual(powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {
      'lib/marketing/copy/homepage.ts': "export const promise = 'Review a live URL'",
    },
    mcpGateSource: mcpGate(),
  }), [])
})

test('rejects missing route parking, inconsistent repository responses, and public links', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: `${proxyHonouringGate().replace('"/api/repo-scans"', '"/api/other"')}\nRepository scanning is not currently available`,
    discoverySources: {
      'lib/docs/content.ts': "href: '/docs/integrations'",
    },
    mcpGateSource: mcpGate(),
  })
  assert.ok(failures.includes('Proxy does not park /api/repo-scans'))
  assert.ok(failures.some((failure) => failure.includes('same not-found boundary')))
  assert.ok(failures.some((failure) => failure.includes('links to a parked')))
})

test('allows the waitlist logged-in review line on pricing copy without setup-route links', () => {
  assert.deepEqual(powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {
      'lib/marketing/copy/plans.ts':
        "features: ['This page and every public page it links to', 'Logged-in review on your computer']",
    },
    mcpGateSource: mcpGate(),
  }), [])
})

test('still rejects parked setup routes next to the waitlist logged-in line', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {
      'lib/marketing/copy/plans.ts':
        "features: ['Logged-in review on your computer']\nhref: '/docs/integrations'",
    },
    mcpGateSource: mcpGate(),
  })
  assert.ok(failures.some((failure) => failure.includes('links to a parked')))
})

/**
 * MCP discovery is withheld by a gate rather than by literal entries in `proxy.ts`, so
 * the guard has to check the gate itself. These are the three ways that arrangement can
 * silently fail: the edge stops consulting the gate, the gate loses a path, or somebody
 * opens the gate and forgets that a list of withheld paths is now stale.
 */
test('reports an edge that stopped consulting the MCP gate', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: parkedProxy(),
    discoverySources: {},
    mcpGateSource: mcpGate(),
  })
  assert.ok(failures.some((failure) => failure.includes('does not consult the MCP discovery gate')))
})

test('reports a gate that stopped withholding a path', () => {
  const trimmed = mcpGate().replace("'/.well-known',", '')
  const failures = powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {},
    mcpGateSource: trimmed,
  })
  assert.ok(failures.includes('MCP gate does not withhold /.well-known'))
})

test('reports a reopened gate so the withheld-path list is revisited on purpose', () => {
  const reopened = mcpGate().replace(
    'export const MCP_IS_DISCOVERABLE = false',
    'export const MCP_IS_DISCOVERABLE = true',
  )
  const failures = powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {},
    mcpGateSource: reopened,
  })
  assert.ok(failures.some((failure) => failure.includes('MCP is discoverable again')))
})

test('rejects a customer surface that links to a withheld MCP path', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {
      'app/(app)/settings/page.tsx': "href: '/dashboard/mcp-setup'",
    },
    mcpGateSource: mcpGate(),
  })
  assert.ok(failures.some((failure) => failure.includes('links to a parked power-tool surface')))
})

test('every gated MCP path is one the gate actually withholds', () => {
  const source = mcpGate()
  for (const prefix of GATED_MCP_DISCOVERY_PREFIXES) {
    assert.ok(source.includes(`'${prefix}'`), `${prefix} is guarded but not withheld`)
  }
})
