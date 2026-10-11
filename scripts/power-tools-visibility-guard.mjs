#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PARKED_PUBLIC_PREFIXES = [
  '/api/integrations/github',
  '/api/repo-scans',
  '/dashboard/mcp-analytics',
  '/help/mcp-and-editors',
  '/report/repo',
  '/settings/integrations',
]

/**
 * MCP discovery paths. These are withheld by a gate rather than by a literal entry in
 * `proxy.ts`, so the two lists cannot be expected to look the same. The gate is checked
 * as a whole instead: if `MCP_IS_DISCOVERABLE` ever flips to true, these paths are
 * advertised again and this list is stale, which the guard reports as a failure so the
 * decision is made deliberately instead of drifting.
 */
export const GATED_MCP_DISCOVERY_PREFIXES = [
  '/dashboard/mcp-setup',
  '/docs/cli',
  '/docs/mcp',
  '/.well-known',
]

const MCP_GATE_MODULE = 'lib/mcp/discoverability.ts'

const ALL_PARKED_PREFIXES = [...PARKED_PUBLIC_PREFIXES, ...GATED_MCP_DISCOVERY_PREFIXES]

const DISCOVERY_PATH_PATTERN = new RegExp(
  ALL_PARKED_PREFIXES.filter((prefix) => !prefix.startsWith('/api/'))
    .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
)

function walk(directory, files = []) {
  if (!existsSync(directory)) return files
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry)
    if (statSync(absolute).isDirectory()) walk(absolute, files)
    else if (/\.(?:ts|tsx|md)$/.test(entry)) files.push(absolute)
  }
  return files
}

function discoveryFiles(root) {
  const files = [
    path.join(root, 'lib/docs/content.ts'),
    path.join(root, 'lib/help/catalog.ts'),
    path.join(root, 'lib/marketing/seo-routes.ts'),
    ...walk(path.join(root, 'lib/marketing/copy')),
    ...walk(path.join(root, 'components/layout')),
    ...walk(path.join(root, 'components/marketing')),
    ...walk(path.join(root, 'components/audit')),
    ...walk(path.join(root, 'components/dashboard')),
    ...walk(path.join(root, 'components/product')),
    ...walk(path.join(root, 'components/report')),
    ...walk(path.join(root, 'app/(marketing)')),
    ...walk(path.join(root, 'app/(app)/dashboard')),
    ...walk(path.join(root, 'app/(app)/settings')),
    ...walk(path.join(root, 'content/docs')),
    path.join(root, 'app/sitemap.ts'),
  ]
  return [...new Set(files)].filter((file) => {
    if (!existsSync(file) || file.includes(`${path.sep}__tests__${path.sep}`)) return false
    // A parked page is not expected to avoid linking to itself. Everything else is.
    if (/(?:dashboard[\\/]mcp-|settings[\\/]integrations|docs[\\/](?:cli|mcp)|help[\\/]mcp)/.test(file)) return false
    if (file === path.join(root, 'content/docs/mcp.md')) return false
    if (/(?:lib[\\/]help[\\/]catalog)\.tsx?$/.test(file)) return false
    return !/(?:copy[\\/]auth|copy[\\/]brand|copy[\\/]tools)\.ts$/.test(file)
  })
}

export function powerToolVisibilityFailures({ proxySource, discoverySources, mcpGateSource }) {
  const failures = []
  for (const prefix of PARKED_PUBLIC_PREFIXES) {
    if (!proxySource.includes(`'${prefix}'`) && !proxySource.includes(`"${prefix}"`)) {
      failures.push(`Proxy does not park ${prefix}`)
    }
  }
  for (const prefix of GATED_MCP_DISCOVERY_PREFIXES) {
    if (!mcpGateSource.includes(`'${prefix}'`) && !mcpGateSource.includes(`"${prefix}"`)) {
      failures.push(`MCP gate does not withhold ${prefix}`)
    }
  }
  if (!/export const MCP_IS_DISCOVERABLE = false\b/.test(mcpGateSource)) {
    failures.push(
      'MCP is discoverable again. Remove the gated prefixes from this guard and re-check every surface the gate used to withhold.',
    )
  }
  if (!/isMcpDiscoveryPath/.test(proxySource)) {
    failures.push('Proxy does not consult the MCP discovery gate, so withheld paths are served')
  }
  if (/Repository scanning is not currently available|code:\s*['"]PARKED['"]/.test(proxySource)) {
    failures.push('Parked repository APIs must return the same not-found boundary as other power tools')
  }
  for (const [file, source] of Object.entries(discoverySources)) {
    if (DISCOVERY_PATH_PATTERN.test(source)) {
      failures.push(`${file} links to a parked power-tool surface`)
    }
    if (/(?:Repository scan|Deployment webhook)/i.test(source)) {
      failures.push(`${file} advertises parked power-tool terminology`)
    }
  }
  return failures
}

export function runPowerToolsVisibilityGuard(root = process.cwd()) {
  const sources = Object.fromEntries(
    discoveryFiles(root).map((file) => [path.relative(root, file), readFileSync(file, 'utf8')]),
  )
  return powerToolVisibilityFailures({
    proxySource: readFileSync(path.join(root, 'proxy.ts'), 'utf8'),
    discoverySources: sources,
    mcpGateSource: readFileSync(path.join(root, MCP_GATE_MODULE), 'utf8'),
  })
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  const failures = runPowerToolsVisibilityGuard()
  if (failures.length > 0) {
    console.error('Power-tools visibility guard failed:\n')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  } else {
    console.log('Power-tools visibility guard passed: unreleased tools remain undiscoverable.')
  }
}
