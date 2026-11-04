#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ALLOWED_TOOLCHAIN_ADVISORIES = new Map([
  ['braces', new Set(['https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'])],
  // Legacy ESLint adapters require minimatch's callable v3 API. These build-only
  // callers use repository-owned glob patterns, never customer-supplied patterns.
  // Runtime audit remains independent and does not accept this exception.
  ['minimatch', new Set(['https://github.com/advisories/GHSA-g3hv-75wg-m249'])],
])

export function inspectToolchainAudit(report) {
  const vulnerabilities = report.vulnerabilities ?? {}
  const memo = new Map()

  function isReviewed(name) {
    if (memo.has(name)) return memo.get(name)
    const visited = new Set()
    let foundAdvisory = false
    // Peer-dependency cycles cannot introduce an advisory or hide an unreviewed
    // one. Inspect each reachable node once and require a real reviewed source.
    function visit(dependency) {
      if (visited.has(dependency)) return true
      visited.add(dependency)
      const vulnerability = vulnerabilities[dependency]
      if (!vulnerability) return false
      const advisories = (vulnerability.via ?? []).filter(item => item && typeof item === 'object')
      const dependencies = (vulnerability.via ?? []).filter(item => typeof item === 'string')
      if (advisories.length) {
        foundAdvisory = true
        const allowed = ALLOWED_TOOLCHAIN_ADVISORIES.get(dependency)
        if (!allowed || vulnerability.isDirect !== false || advisories.some(item => !allowed.has(item.url))) return false
      }
      return (advisories.length > 0 || dependencies.length > 0) && dependencies.every(visit)
    }
    const reviewed = visit(name) && foundAdvisory
    memo.set(name, reviewed)
    return reviewed
  }

  return Object.entries(vulnerabilities)
    .filter(([name]) => !isReviewed(name))
    .map(([name, vulnerability]) => ({
      name,
      severity: vulnerability.severity,
      urls: (vulnerability.via ?? [])
        .filter((item) => typeof item === 'object')
        .map((item) => item.url)
        .filter(Boolean),
    }))
}

export function parseAuditCommandResult(result, phase) {
  const unavailable = (code) => {
    const safeCode = typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'INVALID_REPORT'
    throw new Error(`${phase} dependency audit unavailable (${safeCode})`)
  }
  if (!result.stdout?.trim()) unavailable(result.error?.code ?? 'NO_REPORT')
  let report
  try { report = JSON.parse(result.stdout) } catch { unavailable('INVALID_JSON') }
  if (report?.error) unavailable(report.error.code)
  if (![0, 1].includes(result.status)) unavailable(result.error?.code ?? 'COMMAND_FAILED')
  if (report?.auditReportVersion !== 2 || !report.vulnerabilities || typeof report.vulnerabilities !== 'object'
    || Array.isArray(report.vulnerabilities) || !Number.isInteger(report.metadata?.vulnerabilities?.total)
    || report.metadata.vulnerabilities.total < 0) unavailable('INVALID_REPORT')
  const counts = report.metadata.vulnerabilities
  const levels = ['info', 'low', 'moderate', 'high', 'critical']
  if (levels.some(level => !Number.isInteger(counts[level]) || counts[level] < 0)
    || levels.reduce((sum, level) => sum + counts[level], 0) !== counts.total
    || Object.keys(report.vulnerabilities).length !== counts.total) unavailable('INVALID_REPORT')
  if (result.status !== 0 && !Object.keys(report.vulnerabilities).length) unavailable('COMMAND_FAILED')
  return { status: result.status, report }
}

function runAudit(phase, args) {
  const result = spawnSync('npm', ['audit', '--json', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return parseAuditCommandResult(result, phase)
}

export function main() {
  const runtime = runAudit('Runtime', ['--omit=dev', '--audit-level=moderate'])
  if (runtime.status !== 0 || ['moderate', 'high', 'critical'].some(level => runtime.report.metadata.vulnerabilities[level] > 0)) {
    const names = Object.keys(runtime.report.vulnerabilities ?? {})
    throw new Error(`Runtime dependency audit failed: ${names.join(', ') || 'unknown vulnerability'}`)
  }

  const toolchain = runAudit('Toolchain', ['--audit-level=moderate'])
  const rejected = inspectToolchainAudit(toolchain.report)
  if (rejected.length > 0) {
    throw new Error(`Unreviewed toolchain vulnerabilities: ${JSON.stringify(rejected)}`)
  }

  const known = Object.keys(toolchain.report.vulnerabilities ?? {})
  console.log('PASS runtime dependency audit: no moderate-or-higher vulnerabilities')
  console.log(known.length > 0
    ? `PASS toolchain audit: reviewed build-only advisory paths only (${known.join(', ')})`
    : 'PASS toolchain audit: no moderate-or-higher vulnerabilities')
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
