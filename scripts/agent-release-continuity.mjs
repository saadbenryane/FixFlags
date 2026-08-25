#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const runChecks = args.includes('--check')
const strictMode = args.includes('--strict')
const asJson = args.includes('--json')
const includeAllChecks = args.includes('--all')

function runCommand(command, options = {}) {
  const result = spawnSync(command, {
    shell: true,
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    timeout: options.timeoutMs ?? 90_000,
  })

  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  if (result.status === 0) {
    return { ok: true, output }
  }

  return {
    ok: false,
    output,
    code: result.status,
    unavailable: options.allowMissing && result.error?.code === 'ENOENT',
  }
}

const checks = [
  {
    id: 'local-runtime',
    category: 'runtime',
    label: 'Local app + worker runtime prerequisites',
    command: 'npm run doctor',
    purpose: 'keeps local continuity for web + worker development',
  },
  {
    id: 'cli-mcp',
    category: 'cli',
    label: 'CLI + MCP contract',
    command: 'npm run mcp:quality-gate',
    purpose: 'ensures CLI tool quality contract and MCP compatibility checks stay green',
  },
  {
    id: 'cli-registry',
    category: 'cli',
    label: 'CLI registry availability',
    command: 'npm run cli:registry-guard',
    purpose: 'verifies published CLI version contract for continuity claims',
  },
  {
    id: 'cloud-release-smoke',
    category: 'cloud',
    label: 'Cloud release smoke',
    command: 'npm run smoke:release',
    purpose: 'checks deployed service endpoints, AI provider, browser, and route boundary',
    skipIfEnvMissing: ['PRODUCTION_URL'],
  },
  {
    id: 'release-verify',
    category: 'release',
    label: 'Release validation path',
    command: 'npm run verify:release',
    purpose: 'runs production-like release validation when release resources are present',
  },
]

const runnableChecks = checks.filter((check) => {
  if (!runChecks) return true
  if (check.id === 'release-verify' && !includeAllChecks) return false
  if (!check.skipIfEnvMissing) return true
  return check.skipIfEnvMissing.every((name) => process.env[name])
})

function evaluate(runChecksNow, strict, checksToRun) {
  const now = new Date().toISOString()
  const results = []

  for (const check of checksToRun) {
    const envOk = !check.skipIfEnvMissing || check.skipIfEnvMissing.every((name) => process.env[name])
    if (!envOk) {
      const checkResult = {
        id: check.id,
        category: check.category,
        label: check.label,
        purpose: check.purpose,
        status: 'skipped',
        reason: `required env missing (${check.skipIfEnvMissing.join(', ')})`,
      }
      results.push(checkResult)
      continue
    }

    if (!runChecksNow) {
      results.push({
        id: check.id,
        category: check.category,
        label: check.label,
        purpose: check.purpose,
        status: 'planned',
      })
      continue
    }

    const executed = runCommand(check.command, {
      timeoutMs: check.id === 'release-verify' ? 60 * 60 * 1000 : 90_000,
    })

    results.push({
      id: check.id,
      category: check.category,
      label: check.label,
      purpose: check.purpose,
      status: executed.ok ? 'pass' : 'fail',
      output: runChecksNow ? executed.output : undefined,
      code: executed.code,
      unavailable: executed.unavailable,
    })
  }

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const planned = results.filter((r) => r.status === 'planned').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const decision = strict && failed > 0 ? 'FIX' : passed === checksToRun.length - skipped ? 'PASS' : 'WARN'

  return {
    generatedAt: now,
    mode: runChecksNow ? 'check' : 'plan',
    strict,
    includeAll: includeAllChecks,
    summary: {
      total: results.length,
      passed,
      failed,
      planned,
      skipped,
      decision,
    },
    results,
  }
}

const report = evaluate(runChecks, strictMode, runnableChecks)

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('FixFlags Release Continuity Pulse')
  console.log('----------------------------')
  console.log(`Mode: ${report.mode} (strict=${strictMode})`)
  console.log(`Checks: ${report.summary.total} total · pass=${report.summary.passed} fail=${report.summary.failed} skip=${report.summary.skipped} plan=${report.summary.planned}`)
  console.log(`Decision: ${report.summary.decision}`)

  for (const item of report.results) {
    const status = item.status === 'pass' ? '✅' : item.status === 'fail' ? '❌' : item.status === 'skipped' ? '⏭️' : '📝'
    console.log(`\n${status} ${item.id} [${item.category}]`)
    console.log(`   ${item.label}`)
    console.log(`   ${item.purpose}`)
    if (item.reason) console.log(`   reason: ${item.reason}`)
    if (item.code != null) console.log(`   code: ${item.code}`)
  }

  if (report.summary.failed > 0 && strictMode) {
    process.exitCode = 1
  }
}

if (runChecks && strictMode && report.summary.failed > 0) {
  process.exitCode = 1
}
