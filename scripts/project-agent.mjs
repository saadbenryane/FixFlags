#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  claimLease,
  finishLease,
  heartbeatLease,
  inspectOwnership,
  recordTaskHistory,
  releaseLease,
  validateLeaseStore,
} from './agent-coordination.mjs'
import { buildPlan } from './validate.mjs'

const DEFAULT_LIMIT = 10
const RECOMMENDATION_LIMIT = 5
const FAILURE_LINES = 40
const INSTRUCTION_BUDGET_BYTES = 3500
const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTEXT_MANIFEST = '.agents/context-manifest.json'
const ALLOWED_AUTHORITIES = new Set(['product', 'architecture', 'interface', 'operations', 'evidence'])
const ALLOWED_SOURCE_STATUSES = new Set(['canonical', 'supporting'])
const FORBIDDEN_DEFAULT_CONTEXT = ['.agents/history/', '.agents/sessions/', '.agents/handoffs/']
const OPTIONAL_PLUGIN_TABLES = [
  'plugins."browser@openai-bundled"',
  'plugins."unified-computer-use@openai-bundled"',
  'plugins."computer-use@openai-bundled"',
  'plugins."code-review@openai-bundled"',
  'plugins."visualize@openai-bundled"',
  'plugins."documents@openai-primary-runtime"',
  'plugins."pdf@openai-primary-runtime"',
  'plugins."spreadsheets@openai-primary-runtime"',
  'plugins."presentations@openai-primary-runtime"',
  'plugins."template-creator@openai-primary-runtime"',
  'mcp_servers.node_repl',
  'mcp_servers.computer-use',
  'mcp_servers.fixflags',
  'apps._default',
]

export function loadContextManifest(cwd = MODULE_ROOT) {
  return JSON.parse(readFileSync(path.join(cwd, CONTEXT_MANIFEST), 'utf8'))
}

const defaultManifest = loadContextManifest()
export const contexts = defaultManifest.areas
export const contextAliases = defaultManifest.aliases

export const evals = {
  orientation: ['node', ['scripts/project-agent.mjs', '--json']],
  product: ['npm', ['run', 'product:contract-guard']],
  docs: ['npm', ['run', 'knowledge:duplication-guard']],
  ui: ['npm', ['run', 'ui:drift-guard']],
  audit: ['npm', ['run', 'accuracy:eval']],
  outcomes: ['npm', ['run', 'product:contract-guard']],
  prompts: ['npx', ['vitest', 'run', 'lib/prompts/']],
  'auth-billing': ['npm', ['run', 'billing:plans-guard']],
  cli: ['npm', ['run', 'test:cli']],
  release: ['npm', ['run', 'verify:release']],
  growth: ['npx', ['vitest', 'run', 'lib/growth/', 'lib/analytics/']],
  security: ['npm', ['run', 'security:audit']],
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.status !== 0) return null
  return result.stdout.trim()
}

export function getChangedFiles(cwd) {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const output = result.status === 0 ? result.stdout.replace(/\n$/, '') : null
  if (!output) return []
  return output.split('\n').map((line) => line.slice(3).trim()).filter(Boolean).sort()
}

export function readOwnership(cwd) {
  return inspectOwnership(cwd)
}

function commandText(item) {
  return [item.executable, ...item.args].join(' ')
}

export function buildHome(cwd) {
  const changedFiles = getChangedFiles(cwd)
  const branch = git(cwd, ['branch', '--show-current']) || 'unknown'
  const ownership = readOwnership(cwd)
  const plan = buildPlan('affected', changedFiles)
  const warnings = [...ownership.warnings]
  if (changedFiles.length > 0) warnings.push(`Working tree has ${changedFiles.length} changed file(s); preserve existing work.`)
  if (ownership.expired.length > 0) warnings.push(`${ownership.expired.length} task lease(s) expired and require explicit release or reclaim.`)
  if (ownership.conflicts.length > 0) warnings.push(`${ownership.conflicts.length} ownership overlap(s) need coordination.`)
  const recommendations = plan.commands.map((item) => ({ command: commandText(item), reason: item.label }))
  if (recommendations.length === 0) recommendations.push({ command: 'npm run agent -- context orientation', reason: 'choose a task area' })
  return {
    schemaVersion: 2,
    project: 'fixflags',
    state: { branch, changedFileCount: changedFiles.length, changedFiles, ownership },
    verification: { reason: plan.reason, commandCount: plan.commands.length },
    warnings,
    recommendations,
    next: ['npm run agent -- context <area>'],
  }
}

export function listLearnings(cwd) {
  const directory = path.join(cwd, '.agents/learnings')
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => {
      const file = path.join(directory, name)
      const firstHeading = readFileSync(file, 'utf8').split('\n').find((line) => line.startsWith('# '))
      return { id: name.replace(/\.md$/, ''), title: firstHeading?.slice(2) || name, updatedAt: statSync(file).mtime.toISOString() }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function bounded(items, full, limit = DEFAULT_LIMIT) {
  if (full || items.length <= limit) return { items, total: items.length, truncated: false }
  return { items: items.slice(0, limit), total: items.length, truncated: true }
}

export function boundPayload(payload, full) {
  const copy = structuredClone(payload)
  if (copy.state?.changedFiles) copy.state.changedFiles = bounded(copy.state.changedFiles, full)
  for (const ownership of [copy.state?.ownership, copy.ownership]) {
    if (ownership?.current) ownership.current = bounded(ownership.current, full)
    if (ownership?.conflicts) ownership.conflicts = bounded(ownership.conflicts, full)
    if (ownership?.expired) ownership.expired = bounded(ownership.expired, full)
  }
  if (copy.recommendations) copy.recommendations = bounded(copy.recommendations, full, RECOMMENDATION_LIMIT)
  if (copy.learnings) copy.learnings = bounded(copy.learnings, full)
  if (copy.sources) copy.sources = bounded(copy.sources, full)
  if (copy.commands) copy.commands = bounded(copy.commands, full)
  if (copy.failureExcerpt) copy.failureExcerpt = bounded(copy.failureExcerpt, full, FAILURE_LINES)
  if (copy.checks) copy.checks = bounded(copy.checks, full, 20)
  return copy
}

function printCollection(label, collection, render) {
  console.log(`${label}: ${collection.total === 0 ? '0 results' : collection.total}`)
  for (const item of collection.items) console.log(`  ${render(item)}`)
  if (collection.truncated) console.log(`  … ${collection.total - collection.items.length} more; rerun with --full`)
}

function printOwnership(ownership) {
  console.log(`active leases: ${ownership.activeCount}`)
  printCollection('this worktree', ownership.current, (item) => `${item.taskId} · ${item.owner} · expires ${item.expiresAt}`)
  printCollection('conflicts', ownership.conflicts, (item) => `${item.currentTaskId ? `${item.currentTaskId} ↔ ` : ''}${item.taskId} (${item.owner}): ${(item.reasons || []).join('; ')}`)
  printCollection('expired', ownership.expired, (item) => `${item.taskId} · ${item.owner} · expired ${item.expiresAt}`)
}

export function printHuman(payload) {
  if (payload.command === 'context') {
    console.log(`context: ${payload.area}${payload.requestedArea !== payload.area ? ` (from ${payload.requestedArea})` : ''}`)
    console.log(`description: ${payload.description}`)
    printCollection('sources', payload.sources, (item) => `${item.path} [${item.authority}] — ${item.reason}${item.deeperRoute ? `; deeper: ${item.deeperRoute}` : ''}`)
    printCollection('commands', payload.commands, (item) => item)
  } else if (payload.command === 'learn') {
    printCollection('learnings', payload.learnings, (item) => `${item.id}: ${item.title}`)
    console.log('record: add durable prevention only when a discovery should change future behavior')
  } else if (payload.command === 'verify' || payload.command === 'eval') {
    console.log(`${payload.command}: ${payload.status}`)
    if (payload.reason) console.log(`reason: ${payload.reason}`)
    if (payload.logPath) console.log(`log: ${payload.logPath}`)
    if (payload.commands) printCollection('commands', payload.commands, (item) => item)
    if (payload.failureExcerpt?.total) printCollection('failure', payload.failureExcerpt, (item) => item)
  } else if (payload.command === 'ownership') {
    printOwnership(payload.ownership)
  } else if (payload.command === 'task') {
    console.log(`task ${payload.action}: ${payload.status}`)
    if (payload.lease) console.log(`lease: ${payload.lease.taskId} · ${payload.lease.owner} · ${payload.lease.expiresAt}`)
    if (payload.historyPath) console.log(`history: ${payload.historyPath}`)
    for (const conflict of payload.conflicts || []) console.log(`warning: ${conflict.taskId} (${conflict.owner}) — ${conflict.reasons.join('; ')}`)
  } else if (payload.command === 'doctor') {
    console.log(`doctor: ${payload.status}`)
    printCollection('checks', payload.checks, (item) => `${item.ok ? 'PASS' : 'FAIL'} ${item.name} — ${item.detail}`)
  } else {
    console.log(`project: ${payload.project}`)
    console.log(`branch: ${payload.state.branch}`)
    printCollection('changed files', payload.state.changedFiles, (item) => item)
    printOwnership(payload.state.ownership)
    printCollection('recommendations', payload.recommendations, (item) => `${item.command} — ${item.reason}`)
    console.log(`warnings: ${payload.warnings.length === 0 ? '0 results' : payload.warnings.length}`)
    for (const warning of payload.warnings) console.log(`  ${warning}`)
  }
  if (payload.next?.length) {
    console.log('next:')
    for (const item of payload.next) console.log(`  ${item}`)
  }
}

function writeRunLog(cwd, name, content) {
  const directory = path.join(cwd, '.agent-runs')
  mkdirSync(directory, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(directory, `${stamp}-${name}.log`)
  writeFileSync(file, content)
  return path.relative(cwd, file)
}

function failureExcerpt(text, full) {
  const lines = text.trim().split('\n').filter(Boolean)
  return full ? lines : lines.slice(-FAILURE_LINES)
}

function execute(cwd, executable, args, label, full) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', env: process.env, maxBuffer: 50 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  const logPath = writeRunLog(cwd, label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase(), output)
  return { ok: result.status === 0, status: result.status, logPath, excerpt: result.status === 0 ? [] : failureExcerpt(output, full), unavailable: result.error?.code === 'ENOENT' }
}

function emit(payload, json, full) {
  const boundedPayload = boundPayload(payload, full)
  if (json) console.log(JSON.stringify(boundedPayload, null, 2))
  else printHuman(boundedPayload)
}

function errorPayload(code, message, recovery) {
  return { schemaVersion: 2, error: { code, message, recovery } }
}

function emitError(payload, json) {
  if (json) console.error(JSON.stringify(payload))
  else console.error(`error: ${payload.error.message}\nrecovery: ${payload.error.recovery}`)
}

function parseArguments(argv) {
  const valueFlags = new Set(['--owner', '--scope', '--title', '--path', '--reclaim', '--summary', '--evidence'])
  const options = { json: false, full: false, dryRun: false, paths: [], evidence: [] }
  const positionals = []
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--json') options.json = true
    else if (argument === '--full') options.full = true
    else if (argument === '--dry-run') options.dryRun = true
    else if (valueFlags.has(argument)) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`)
      index += 1
      if (argument === '--path') options.paths.push(value)
      else if (argument === '--evidence') options.evidence.push(value)
      else options[argument.slice(2)] = value
    } else if (argument.startsWith('--')) throw new Error(`Unknown option: ${argument}`)
    else positionals.push(argument)
  }
  return { options, positionals }
}

export function validateContextManifest(cwd) {
  const errors = []
  let manifest
  try {
    manifest = loadContextManifest(cwd)
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)], areaCount: 0 }
  }
  if (manifest.schemaVersion !== 1) errors.push('context manifest schemaVersion must be 1')
  if (!manifest.areas || typeof manifest.areas !== 'object') errors.push('context manifest requires areas')
  for (const [area, context] of Object.entries(manifest.areas || {})) {
    if (!context.description) errors.push(`${area}: missing description`)
    if (!Array.isArray(context.sources) || context.sources.length === 0 || context.sources.length > 5) errors.push(`${area}: requires 1-5 sources`)
    for (const source of context.sources || []) {
      if (!source.path || !existsSync(path.join(cwd, source.path))) errors.push(`${area}: missing source ${source.path || '(empty)'}`)
      if (!ALLOWED_SOURCE_STATUSES.has(source.status)) errors.push(`${area}/${source.path}: historical or invalid status ${source.status}`)
      if (!ALLOWED_AUTHORITIES.has(source.authority)) errors.push(`${area}/${source.path}: invalid authority ${source.authority}`)
      if (!source.reason) errors.push(`${area}/${source.path}: missing reason`)
      if (source.deeperRoute && !manifest.areas[source.deeperRoute] && !manifest.aliases?.[source.deeperRoute]) errors.push(`${area}/${source.path}: unknown deeper route ${source.deeperRoute}`)
    }
  }
  for (const [alias, target] of Object.entries(manifest.aliases || {})) if (!manifest.areas[target]) errors.push(`alias ${alias}: unknown target ${target}`)
  return { ok: errors.length === 0, errors, areaCount: Object.keys(manifest.areas || {}).length }
}

function tableBody(content, name) {
  const marker = `[${name}]`
  const start = content.indexOf(marker)
  if (start === -1) return null
  const remainder = content.slice(start + marker.length)
  const next = remainder.search(/\n\s*\[[^\]]+\]/)
  return next === -1 ? remainder : remainder.slice(0, next)
}

function validateOptionalTools(cwd) {
  const file = path.join(cwd, '.codex/config.toml')
  if (!existsSync(file)) return { ok: false, detail: 'missing .codex/config.toml' }
  const content = readFileSync(file, 'utf8')
  const failures = OPTIONAL_PLUGIN_TABLES.filter((name) => {
    const body = tableBody(content, name)
    return body == null || !/^\s*enabled\s*=\s*false\s*$/m.test(body)
  })
  const core = tableBody(content, 'plugins."codex-app-tools@openai-bundled"')
  if (core == null || !/^\s*enabled\s*=\s*true\s*$/m.test(core)) failures.push('plugins."codex-app-tools@openai-bundled"')
  return { ok: failures.length === 0, detail: failures.length ? `unexpected tool policy: ${failures.join(', ')}` : `${OPTIONAL_PLUGIN_TABLES.length} optional surfaces disabled; core app tools enabled` }
}

function validateRoutedMetadata(cwd) {
  const manifest = loadContextManifest(cwd)
  const routedSources = [...new Map(Object.values(manifest.areas).flatMap((area) => area.sources)
    .filter((source) => source.path.endsWith('.md') && !source.path.endsWith('/SKILL.md'))
    .map((source) => [source.path, source])).values()]
  const authorityMap = readFileSync(path.join(cwd, 'CANONICAL-SOURCES.md'), 'utf8')
  const activeAuthorityMap = authorityMap.split('\n## Historical or retired sources')[0]
  const authorityPaths = [...activeAuthorityMap.matchAll(/\]\(([^)#]+\.md)(?:#[^)]+)?\)/g)]
    .map((match) => match[1])
    .filter((sourcePath) => existsSync(path.join(cwd, sourcePath)))
  const routedByPath = new Map(routedSources.map((source) => [source.path, source]))
  const sources = [...new Set([...routedSources.map((source) => source.path), ...authorityPaths])].sort()
  const failures = []
  for (const sourcePath of sources) {
    const content = readFileSync(path.join(cwd, sourcePath), 'utf8')
    const header = content.startsWith('---\n') ? content.slice(4, content.indexOf('\n---\n', 4)) : ''
    const status = header.match(/^status:\s*(\S+)\s*$/m)?.[1]
    const authority = header.match(/^authority:\s*(\S+)\s*$/m)?.[1]
    const reviewedAt = header.match(/^reviewed_at:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1]
    const routed = routedByPath.get(sourcePath)
    const invalid = !ALLOWED_SOURCE_STATUSES.has(status)
      || !ALLOWED_AUTHORITIES.has(authority)
      || !reviewedAt
      || !/^supersedes:\s*/m.test(header)
      || (routed && (status !== routed.status || authority !== routed.authority))
    if (invalid) failures.push(sourcePath)
  }
  return { ok: failures.length === 0, detail: failures.length ? `missing or mismatched metadata: ${failures.join(', ')}` : `${sources.length} active authority and routed Markdown sources have valid metadata` }
}

function validateRouteIsolation(cwd) {
  const manifest = loadContextManifest(cwd)
  const paths = Object.values(manifest.areas).flatMap((area) => area.sources.map((source) => source.path))
  const failures = paths.filter((sourcePath) => FORBIDDEN_DEFAULT_CONTEXT.some((forbidden) => sourcePath === forbidden || sourcePath.startsWith(forbidden)))
  return { ok: failures.length === 0, detail: failures.length ? `default routes include history: ${failures.join(', ')}` : 'sessions, handoffs, board, and history are excluded' }
}

function validateCurrentAuthority(cwd) {
  const markdown = (git(cwd, ['ls-files', '*.md']) || '').split('\n').filter(Boolean).filter((sourcePath) =>
    !sourcePath.startsWith('.agents/history/')
    && !sourcePath.startsWith('.agents/sessions/')
    && !sourcePath.startsWith('.agents/handoffs/')
    && sourcePath !== '.agents/BOARD-archive.md',
  ).filter((sourcePath) => existsSync(path.join(cwd, sourcePath)))
  const stale = markdown.filter((sourcePath) => {
    const content = readFileSync(path.join(cwd, sourcePath), 'utf8')
    return /September 8 vision|September 8[^\n]{0,80}(?:current|active|authoritative)|sole active direction[^\n]{0,80}September 8/i.test(content)
  })
  return { ok: stale.length === 0, detail: stale.length ? `stale authority wording: ${stale.join(', ')}` : 'current documentation uses the September 21 authority' }
}

function validateTelemetryPrivacy(cwd) {
  const tracked = (git(cwd, ['ls-files', '.agents/evals/harness/runs.jsonl', 'scripts/agent-evals/reports/*.json']) || '')
    .split('\n').filter(Boolean).filter((file) => existsSync(path.join(cwd, file)))
  return { ok: tracked.length === 0, detail: tracked.length ? `tracked local telemetry: ${tracked.join(', ')}` : 'raw run telemetry and generated eval reports are untracked or removed' }
}

function validateHarnessNames(cwd) {
  const files = ['scripts/harness-benchmark.mjs', 'scripts/harness-benchmark.test.mjs', 'scripts/agent-evals/cases.mjs', 'scripts/agent-evals/config.mjs', '.agents/evals/harness/README.md']
  const stale = files.filter((file) => /qewos|report-ui|\baxi\b/i.test(readFileSync(path.join(cwd, file), 'utf8')))
  return { ok: stale.length === 0, detail: stale.length ? `stale harness naming: ${stale.join(', ')}` : 'FixFlags and current Site scenarios only' }
}

function validateCustomerIntegrations(cwd) {
  const result = spawnSync(process.execPath, ['scripts/skill-validator.mjs'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const detail = result.status === 0 ? 'public customer skill and IDE integrations validate' : `${result.stderr || result.stdout}`.trim().split('\n').slice(-3).join('; ')
  return { ok: result.status === 0, detail }
}

export function buildDoctor(cwd) {
  const checks = []
  const agentsPath = path.join(cwd, 'AGENTS.md')
  const agentsBytes = existsSync(agentsPath) ? statSync(agentsPath).size : 0
  checks.push({ name: 'instruction-budget', ok: agentsBytes > 0 && agentsBytes <= INSTRUCTION_BUDGET_BYTES, detail: `${agentsBytes}/${INSTRUCTION_BUDGET_BYTES} bytes` })
  const manifest = validateContextManifest(cwd)
  checks.push({ name: 'context-manifest', ok: manifest.ok, detail: manifest.ok ? `${manifest.areaCount} valid areas` : manifest.errors.join('; ') })
  checks.push({ name: 'routed-metadata', ...validateRoutedMetadata(cwd) })
  checks.push({ name: 'route-isolation', ...validateRouteIsolation(cwd) })
  checks.push({ name: 'current-authority', ...validateCurrentAuthority(cwd) })
  checks.push({ name: 'optional-tools', ...validateOptionalTools(cwd) })
  checks.push({ name: 'customer-integrations', ...validateCustomerIntegrations(cwd) })
  checks.push({ name: 'telemetry-privacy', ...validateTelemetryPrivacy(cwd) })
  checks.push({ name: 'harness-naming', ...validateHarnessNames(cwd) })
  const leaseStore = validateLeaseStore(cwd)
  checks.push({ name: 'lease-store', ok: leaseStore.ok && leaseStore.expired === 0, detail: `${leaseStore.active} active, ${leaseStore.expired} expired${leaseStore.warnings.length ? `; ${leaseStore.warnings.join('; ')}` : ''}` })
  return { schemaVersion: 2, command: 'doctor', status: checks.every((item) => item.ok) ? 'passed' : 'failed', checks, next: ['npm run agent'] }
}

function resolveContext(cwd, requestedArea) {
  const manifest = loadContextManifest(cwd)
  const area = manifest.aliases?.[requestedArea] || requestedArea
  return { area, context: manifest.areas[area], available: Object.keys(manifest.areas) }
}

export function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  let parsed
  try {
    parsed = parseArguments(argv)
  } catch (error) {
    const payload = errorPayload('INVALID_OPTIONS', error instanceof Error ? error.message : String(error), 'Run npm run agent -- context orientation.')
    emitError(payload, argv.includes('--json'))
    return 2
  }
  const { options, positionals } = parsed
  const command = positionals[0] || 'home'
  try {
    if (command === 'home' || command === 'status') {
      emit(buildHome(cwd), options.json, options.full)
      return 0
    }
    if (command === 'context') {
      const requestedArea = positionals[1]
      const resolved = resolveContext(cwd, requestedArea)
      if (!resolved.context) {
        const payload = errorPayload('UNKNOWN_CONTEXT', `Unknown context: ${requestedArea || '(missing)'}`, `Choose one of: ${resolved.available.join(', ')}`)
        emitError(payload, options.json)
        return 2
      }
      emit({ schemaVersion: 2, command, requestedArea, area: resolved.area, ...resolved.context }, options.json, options.full)
      return 0
    }
    if (command === 'ownership') {
      emit({ schemaVersion: 2, command, ownership: inspectOwnership(cwd), next: ['npm run agent -- task claim <id> --owner <name> --scope <scope> --path <path>'] }, options.json, options.full)
      return 0
    }
    if (command === 'task') {
      const action = positionals[1]
      const taskId = positionals[2]
      if (!['claim', 'heartbeat', 'finish', 'release'].includes(action) || !taskId) {
        const payload = errorPayload('INVALID_TASK_COMMAND', 'Use task claim, heartbeat, finish, or release with a task id.', 'Example: npm run agent -- task claim my-task --owner codex --scope "Focused change" --path scripts/')
        emitError(payload, options.json)
        return 2
      }
      if (action === 'claim') {
        const result = claimLease(cwd, { taskId, owner: options.owner, title: options.title, scope: options.scope, relatedPaths: options.paths, reclaimReason: options.reclaim })
        emit({ schemaVersion: 2, command, action, status: 'claimed', ...result, next: [`npm run agent -- task heartbeat ${taskId} --owner ${result.lease.owner}`] }, options.json, options.full)
        return 0
      }
      if (action === 'heartbeat') {
        const lease = heartbeatLease(cwd, taskId, options.owner)
        emit({ schemaVersion: 2, command, action, status: 'renewed', lease, conflicts: [], next: ['npm run agent -- ownership'] }, options.json, options.full)
        return 0
      }
      if (action === 'finish') {
        const expectedHistory = path.join(cwd, '.agents/history/tasks', `${taskId}.md`)
        if (options.summary && existsSync(expectedHistory)) throw new Error(`Durable history already exists for ${taskId}; choose a unique task id or omit --summary.`)
        const lease = finishLease(cwd, taskId, options.owner)
        const historyPath = recordTaskHistory(cwd, lease, { summary: options.summary, evidence: options.evidence })
        emit({ schemaVersion: 2, command, action, status: 'finished', lease, historyPath, conflicts: [], next: ['npm run agent -- ownership'] }, options.json, options.full)
        return 0
      }
      const lease = releaseLease(cwd, taskId, options.owner)
      emit({ schemaVersion: 2, command, action, status: 'released', lease, conflicts: [], next: ['npm run agent -- ownership'] }, options.json, options.full)
      return 0
    }
    if (command === 'doctor') {
      const payload = buildDoctor(cwd)
      emit(payload, options.json, options.full)
      return payload.status === 'passed' ? 0 : 1
    }
    if (command === 'learn') {
      emit({ schemaVersion: 2, command, learnings: listLearnings(cwd), next: ['npm run agent -- context <area>'] }, options.json, options.full)
      return 0
    }
    if (command === 'verify') {
      const mode = options.full ? 'full' : 'affected'
      const plan = buildPlan(mode, getChangedFiles(cwd))
      const commands = plan.commands.map(commandText)
      if (options.dryRun || commands.length === 0) {
        emit({ schemaVersion: 2, command, status: commands.length ? 'planned' : 'no checks required', reason: plan.reason, commands, next: commands.length ? ['npm run agent -- verify'] : ['npm run agent -- context orientation'] }, options.json, options.full)
        return 0
      }
      let lastLog = null
      for (const item of plan.commands) {
        const result = execute(cwd, item.executable, item.args, item.label, options.full)
        lastLog = result.logPath
        if (!result.ok) {
          emit({ schemaVersion: 2, command, status: result.unavailable ? 'unavailable' : 'failed', reason: item.label, logPath: result.logPath, failureExcerpt: result.excerpt, next: [`Open ${result.logPath}`] }, options.json, options.full)
          return result.unavailable ? 3 : 1
        }
      }
      emit({ schemaVersion: 2, command, status: 'passed', reason: plan.reason, logPath: lastLog, commands, next: ['npm run agent -- eval orientation'] }, options.json, options.full)
      return 0
    }
    if (command === 'eval') {
      const requestedArea = positionals[1]
      const resolved = resolveContext(cwd, requestedArea)
      const spec = evals[resolved.area]
      if (!spec) {
        const payload = errorPayload('UNKNOWN_EVAL', `Unknown eval: ${requestedArea || '(missing)'}`, `Choose one of: ${Object.keys(evals).join(', ')}`)
        emitError(payload, options.json)
        return 2
      }
      const [executable, commandArgs] = spec
      if (options.dryRun) {
        emit({ schemaVersion: 2, command, status: 'planned', reason: resolved.area, commands: [[executable, ...commandArgs].join(' ')], next: [`npm run agent -- eval ${resolved.area}`] }, options.json, options.full)
        return 0
      }
      const result = execute(cwd, executable, commandArgs, `eval-${resolved.area}`, options.full)
      emit({ schemaVersion: 2, command, status: result.ok ? 'passed' : result.unavailable ? 'unavailable' : 'failed', reason: resolved.area, logPath: result.logPath, failureExcerpt: result.excerpt, next: result.ok ? [] : [`Open ${result.logPath}`] }, options.json, options.full)
      return result.ok ? 0 : result.unavailable ? 3 : 1
    }
    const payload = errorPayload('UNKNOWN_COMMAND', `Unknown command: ${command}`, 'Use: agent [status|context <area>|ownership|task <action>|doctor|verify|eval <area>|learn]')
    emitError(payload, options.json)
    return 2
  } catch (error) {
    const payload = errorPayload('INTERNAL_ERROR', error instanceof Error ? error.message : String(error), 'Inspect repository and lease state, then rerun with --json.')
    emitError(payload, options.json)
    return 1
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) process.exitCode = main()
