#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PARKED_PUBLIC_PREFIXES = [
  '/.well-known/mcp.json',
  '/.well-known/mcp-server.json',
  '/.well-known/skills/fixflags',
  '/api/api-keys',
  '/api/cli',
  '/api/integrations/github',
  '/api/mcp',
  '/api/repo-scans',
  '/api/webhooks/railway',
  '/api/well-known/mcp-json',
  '/cli/authorize',
  '/dashboard/mcp-analytics',
  '/dashboard/mcp-setup',
  '/docs/cli',
  '/docs/integrations',
  '/docs/mcp',
  '/help/mcp',
  '/help/mcp-and-editors',
  '/report/repo',
  '/settings/api-keys',
  '/settings/integrations',
]

const DISCOVERY_PATH_PATTERN = new RegExp(
  PARKED_PUBLIC_PREFIXES
    .filter((prefix) => !prefix.startsWith('/api/'))
    .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
)

function walk(directory, files = []) {
  if (!existsSync(directory)) return files
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry)
    if (statSync(absolute).isDirectory()) walk(absolute, files)
    else if (/\.(?:ts|tsx)$/.test(entry)) files.push(absolute)
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
    path.join(root, 'app/sitemap.ts'),
  ]
  return [...new Set(files)].filter((file) => {
    if (!existsSync(file) || file.includes(`${path.sep}__tests__${path.sep}`)) return false
    return !/(?:copy[\\/]auth|copy[\\/]brand|copy[\\/]tools)\.ts$/.test(file)
  })
}

export function powerToolVisibilityFailures({ proxySource, discoverySources }) {
  const failures = []
  for (const prefix of PARKED_PUBLIC_PREFIXES) {
    if (!proxySource.includes(`'${prefix}'`) && !proxySource.includes(`"${prefix}"`)) {
      failures.push(`Proxy does not park ${prefix}`)
    }
  }
  if (/Repository scanning is not currently available|code:\s*['"]PARKED['"]/.test(proxySource)) {
    failures.push('Parked repository APIs must return the same not-found boundary as other power tools')
  }
  for (const [file, source] of Object.entries(discoverySources)) {
    if (DISCOVERY_PATH_PATTERN.test(source)) {
      failures.push(`${file} links to a parked power-tool surface`)
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
    console.log('Power-tools visibility guard passed: parked code is retained but undiscoverable.')
  }
}
