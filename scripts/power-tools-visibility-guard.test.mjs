import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PARKED_PUBLIC_PREFIXES,
  powerToolVisibilityFailures,
  runPowerToolsVisibilityGuard,
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
  }), [])
})

test('the real rendered public sources contain no withheld power-tool link', () => {
  assert.deepEqual(runPowerToolsVisibilityGuard(root), [])
})

test('allows published store and Google integration guides', () => {
  assert.deepEqual(powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {
      'content/docs/integrations.md': '/docs/integrations/shopify /docs/integrations/google-analytics /docs/integrations/google-search-console',
    },
  }), [])
})

test('rejects missing route parking, inconsistent repository responses, and public links', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: `${proxyHonouringGate().replace('"/api/repo-scans"', '"/api/other"')}\nRepository scanning is not currently available`,
    discoverySources: {
      'lib/docs/content.ts': "href: '/report/repo/scan-1'",
    },
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
  }), [])
})

test('still rejects parked setup routes next to the waitlist logged-in line', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {
      'lib/marketing/copy/plans.ts':
        "features: ['Logged-in review on your computer']\nhref: '/help/mcp-and-editors'",
    },
  })
  assert.ok(failures.some((failure) => failure.includes('links to a parked')))
})

/**
 * MCP discovery is public by owner decision since 2026-11-10. The guard no longer
 * withholds its paths, but the edge must keep consulting the gate so it can be closed
 * again, and the public MCP surfaces are now scanned like every other public source.
 */
test('reports an edge that stopped consulting the MCP gate', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: parkedProxy(),
    discoverySources: {},
  })
  assert.ok(failures.some((failure) => failure.includes('does not consult the MCP discovery gate')))
})

test('passes with the MCP discovery gate open', () => {
  assert.match(mcpGate(), /export const MCP_IS_DISCOVERABLE = true\b/)
  assert.deepEqual(powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {},
  }), [])
})

test('allows public links to the MCP guide, setup page, and explainer', () => {
  assert.deepEqual(powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: {
      'app/(app)/settings/page.tsx': "href: '/dashboard/mcp-setup'",
      'content/docs/index.md': '[MCP for coding agents](/docs/mcp)',
      'lib/marketing/copy/homepage.ts': "href: '/docs/fix-with-ai#what-is-mcp', label: 'Learn about MCP'",
    },
  }), [])
})

test('scans the public MCP guide for parked power-tool terminology', () => {
  const failures = powerToolVisibilityFailures({
    proxySource: proxyHonouringGate(),
    discoverySources: { 'content/docs/mcp.md': 'Start a Repository scan from your agent.' },
  })
  assert.ok(failures.includes('content/docs/mcp.md advertises parked power-tool terminology'))
})

test('rejects parked agent-access claims in public discovery', () => {
  assert.ok(powerToolVisibilityFailures({ proxySource: proxyHonouringGate(),
    discoverySources: { 'lib/marketing/copy/homepage.ts': "features: ['Agent access']" } })
    .some(failure => failure.includes('links to a parked')))
})
