#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { buildPlan } from './validate.mjs'

const DEFAULT_LIMIT = 10
const RECOMMENDATION_LIMIT = 5
const FAILURE_LINES = 40

export const contexts = {
  orientation: {
    description: 'Understand the repository, product truth, and current priorities.',
    files: ['AGENTS.md', 'PRODUCT.md', 'ROADMAP.md', 'CODEMAP.md'],
    commands: ['npm run agent', 'npm run agent -- verify --dry-run'],
  },
  ui: {
    description: 'Change report or application UI without drifting from the design system.',
    files: ['DESIGN.md', 'lib/design/tokens.css', 'components/audit/', 'components/report/'],
    commands: ['npm run ui:drift-guard', 'npm run agent -- verify'],
  },
  audit: {
    description: 'Work on deterministic checks, scoring, capture, persistence, or the audit pipeline.',
    files: ['docs/audit-pipeline.md', 'lib/audit/', 'QUALITY.md'],
    commands: ['npx vitest run lib/audit/', 'npm run audit:capabilities'],
  },
  prompts: {
    description: 'Change triage or prescription prompts while preserving cacheable system prefixes.',
    files: ['lib/prompts/system-prompt.ts', 'lib/audit/judge-config.ts', 'lib/billing/costs.ts'],
    commands: ['npx vitest run lib/prompts/', 'npm run agent -- verify'],
  },
  billing: {
    description: 'Change plans, entitlements, checkout, or billing gates.',
    files: ['lib/billing/', 'lib/auth/entitlements.ts', 'docs/stripe-setup.md'],
    commands: ['npx vitest run lib/billing/', 'npm run agent -- verify'],
  },
  cli: {
    description: 'Work on the public FixFlags CLI and its task-shaped workflows.',
    files: ['fixflags-cli/src/', 'fixflags-cli/test/', 'fixflags-cli/README.md'],
    commands: ['npm --prefix fixflags-cli test', 'npm --prefix fixflags-cli run build'],
  },
  docs: {
    description: 'Update the canonical knowledge source without duplicating facts.',
    files: ['CANONICAL-SOURCES.md', 'EVOLUTION-RULES.md', 'knowledge/README.md'],
    commands: ['npm run knowledge:duplication-guard', 'npm run agent -- verify --dry-run'],
  },
  recovery: {
    description: 'Investigate failed queues, workers, degraded audits, or deployment behavior.',
    files: ['QUALITY.md', 'DEVELOPMENT.md', 'lib/queue/', '.agents/learnings/'],
    commands: ['npm run agent -- learn', 'npm run agent -- verify --dry-run'],
  },
  release: {
    description: 'Build and validate the production-like web, worker, database, and container release path.',
    files: ['Dockerfile', 'scripts/runtime-start.mjs', 'scripts/validate.mjs', 'lib/health/', 'DEVELOPMENT.md'],
    commands: ['npm run agent -- eval release', 'npm run verify:release'],
  },
  growth: {
    description: 'Change scheduled acquisition, analytics artifacts, nurture, or growth reporting safely.',
    files: ['lib/growth/', 'lib/analytics/', 'lib/queue/recovery-scheduler.ts', 'app/admin/analytics/'],
    commands: ['npm run agent -- eval growth', 'npm run agent -- verify --dry-run'],
  },
  auth: {
    description: 'Change authentication, anonymous claiming, sessions, recovery, or entitlements.',
    files: ['lib/auth/', 'app/(auth)/', 'SECURITY.md'],
    commands: ['npm run agent -- eval auth', 'npm run agent -- verify --dry-run'],
  },
  security: {
    description: 'Review access control, protected sharing, webhooks, secrets, middleware, and release boundaries.',
    files: ['SECURITY.md', 'lib/security/', 'middleware.ts', 'app/api/webhooks/'],
    commands: ['npm run agent -- eval security', 'npm run agent -- verify --dry-run'],
  },
}

export const evals = {
  orientation: ['node', ['scripts/project-agent.mjs', '--json']],
  docs: ['npm', ['run', 'knowledge:duplication-guard']],
  ui: ['npx', ['playwright', 'test', '--grep', 'detailed sample fulfills']],
  audit: ['npm', ['run', 'demo:audit:offline']],
  prompts: ['npx', ['vitest', 'run', 'lib/prompts/']],
  billing: ['npx', ['vitest', 'run', 'lib/billing/']],
  cli: ['npm', ['run', 'test:cli']],
  recovery: ['node', ['scripts/evals/runtime-recovery.mjs']],
  release: ['npm', ['run', 'verify:release']],
  growth: ['npx', ['vitest', 'run', 'lib/growth/', 'lib/analytics/']],
  auth: ['npx', ['vitest', 'run', 'lib/auth/', 'app/(auth)/']],
  security: ['npx', ['vitest', 'run', 'lib/security/', 'app/api/webhooks/']],
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
  const boardPath = path.join(cwd, '.agents/BOARD.md')
  if (!existsSync(boardPath)) return { state: 'missing', active: [] }
  const active = readFileSync(boardPath, 'utf8')
    .split('\n')
    .filter((line) => /^\|[^-].*\|\s*(?:claimed|in_progress|active)\s*\|/i.test(line))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean)
      return { task: cells[0], status: cells[1], owner: cells[2] }
    })
  return { state: 'available', active }
}

function commandText(item) {
  return [item.executable, ...item.args].join(' ')
}

export function buildHome(cwd) {
  const changedFiles = getChangedFiles(cwd)
  const branch = git(cwd, ['branch', '--show-current']) || 'unknown'
  const ownership = readOwnership(cwd)
  const plan = buildPlan('affected', changedFiles)
  const warnings = []
  if (branch !== 'main') warnings.push(`Expected pre-production branch main; current branch is ${branch}.`)
  if (changedFiles.length > 0) warnings.push(`Working tree has ${changedFiles.length} changed file(s); preserve existing work.`)
  if (ownership.state === 'missing') warnings.push('Task board is missing; coordinate ownership before writing.')

  const recommendations = plan.commands.map((item) => ({
    command: commandText(item),
    reason: item.label,
  }))
  if (recommendations.length === 0) {
    recommendations.push({ command: 'npm run agent -- context orientation', reason: 'choose a task area' })
  }

  return {
    schemaVersion: 1,
    project: 'qewos',
    state: { branch, changedFileCount: changedFiles.length, changedFiles, ownership },
    verification: { reason: plan.reason, commandCount: plan.commands.length },
    warnings,
    recommendations,
    next: ['npm run agent -- verify --dry-run', 'npm run agent -- context <area>'],
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
  if (copy.state?.ownership?.active) copy.state.ownership.active = bounded(copy.state.ownership.active, full)
  if (copy.recommendations) copy.recommendations = bounded(copy.recommendations, full, RECOMMENDATION_LIMIT)
  if (copy.learnings) copy.learnings = bounded(copy.learnings, full)
  if (copy.files) copy.files = bounded(copy.files, full)
  if (copy.commands) copy.commands = bounded(copy.commands, full)
  if (copy.failureExcerpt) copy.failureExcerpt = bounded(copy.failureExcerpt, full, FAILURE_LINES)
  return copy
}

function printCollection(label, collection, render) {
  console.log(`${label}: ${collection.total === 0 ? '0 results' : collection.total}`)
  for (const item of collection.items) console.log(`  ${render(item)}`)
  if (collection.truncated) console.log(`  … ${collection.total - collection.items.length} more; rerun with --full`)
}

export function printHuman(payload) {
  if (payload.command === 'context') {
    console.log(`context: ${payload.area}`)
    console.log(`description: ${payload.description}`)
    printCollection('files', payload.files, (item) => item)
    printCollection('commands', payload.commands, (item) => item)
  } else if (payload.command === 'learn') {
    printCollection('learnings', payload.learnings, (item) => `${item.id}: ${item.title}`)
    console.log('record: add evidence to .agents/learnings/README.md format; promote prevention into code or tests')
  } else if (payload.command === 'verify' || payload.command === 'eval') {
    console.log(`${payload.command}: ${payload.status}`)
    if (payload.reason) console.log(`reason: ${payload.reason}`)
    if (payload.logPath) console.log(`log: ${payload.logPath}`)
    if (payload.commands) printCollection('commands', payload.commands, (item) => item)
    if (payload.failureExcerpt?.total) printCollection('failure', payload.failureExcerpt, (item) => item)
  } else {
    console.log(`project: ${payload.project}`)
    console.log(`branch: ${payload.state.branch}`)
    printCollection('changed files', payload.state.changedFiles, (item) => item)
    printCollection('active ownership', payload.state.ownership.active, (item) => `${item.task} · ${item.owner} · ${item.status}`)
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
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  const logPath = writeRunLog(cwd, label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase(), output)
  return {
    ok: result.status === 0,
    status: result.status,
    logPath,
    excerpt: result.status === 0 ? [] : failureExcerpt(output, full),
    unavailable: result.error?.code === 'ENOENT',
  }
}

function emit(payload, json, full) {
  const boundedPayload = boundPayload(payload, full)
  if (json) console.log(JSON.stringify(boundedPayload, null, 2))
  else printHuman(boundedPayload)
}

function errorPayload(code, message, recovery) {
  return { schemaVersion: 1, error: { code, message, recovery } }
}

export function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const json = argv.includes('--json')
  const full = argv.includes('--full')
  const dryRun = argv.includes('--dry-run')
  const args = argv.filter((arg) => !['--json', '--full', '--dry-run'].includes(arg))
  const command = args[0] || 'home'

  try {
    if (command === 'home') {
      emit(buildHome(cwd), json, full)
      return 0
    }
    if (command === 'context') {
      const area = args[1]
      const context = contexts[area]
      if (!context) {
        const payload = errorPayload('UNKNOWN_CONTEXT', `Unknown context: ${area || '(missing)'}`, `Choose one of: ${Object.keys(contexts).join(', ')}`)
        if (json) console.error(JSON.stringify(payload))
        else console.error(`error: ${payload.error.message}\nrecovery: ${payload.error.recovery}`)
        return 2
      }
      emit({ schemaVersion: 1, command, area, ...context, next: [`npm run agent -- eval ${area}`, 'npm run agent -- verify --dry-run'] }, json, full)
      return 0
    }
    if (command === 'learn') {
      emit({ schemaVersion: 1, command, learnings: listLearnings(cwd), next: ['npm run agent -- context <area>', 'npm run agent -- verify --dry-run'] }, json, full)
      return 0
    }
    if (command === 'verify') {
      const mode = full ? 'full' : 'affected'
      const plan = buildPlan(mode, getChangedFiles(cwd))
      const commands = plan.commands.map(commandText)
      if (dryRun || commands.length === 0) {
        emit({ schemaVersion: 1, command, status: commands.length ? 'planned' : 'no checks required', reason: plan.reason, commands, next: commands.length ? ['npm run agent -- verify'] : ['npm run agent -- context orientation'] }, json, full)
        return 0
      }
      let lastLog = null
      for (const item of plan.commands) {
        const result = execute(cwd, item.executable, item.args, item.label, full)
        lastLog = result.logPath
        if (!result.ok) {
          emit({ schemaVersion: 1, command, status: result.unavailable ? 'unavailable' : 'failed', reason: item.label, logPath: result.logPath, failureExcerpt: result.excerpt, next: [`Open ${result.logPath}`, 'npm run agent -- verify --dry-run'] }, json, full)
          return result.unavailable ? 3 : 1
        }
      }
      emit({ schemaVersion: 1, command, status: 'passed', reason: plan.reason, logPath: lastLog, commands, next: ['npm run agent -- eval orientation'] }, json, full)
      return 0
    }
    if (command === 'eval') {
      const area = args[1]
      const spec = evals[area]
      if (!spec) {
        const payload = errorPayload('UNKNOWN_EVAL', `Unknown eval: ${area || '(missing)'}`, `Choose one of: ${Object.keys(evals).join(', ')}`)
        if (json) console.error(JSON.stringify(payload))
        else console.error(`error: ${payload.error.message}\nrecovery: ${payload.error.recovery}`)
        return 2
      }
      const [executable, commandArgs] = spec
      if (dryRun) {
        emit({ schemaVersion: 1, command, status: 'planned', reason: area, commands: [[executable, ...commandArgs].join(' ')], next: [`npm run agent -- eval ${area}`] }, json, full)
        return 0
      }
      const result = execute(cwd, executable, commandArgs, `eval-${area}`, full)
      emit({ schemaVersion: 1, command, status: result.ok ? 'passed' : result.unavailable ? 'unavailable' : 'failed', reason: area, logPath: result.logPath, failureExcerpt: result.excerpt, next: result.ok ? ['npm run agent -- verify --dry-run'] : [`Open ${result.logPath}`] }, json, full)
      return result.ok ? 0 : result.unavailable ? 3 : 1
    }

    const payload = errorPayload('UNKNOWN_COMMAND', `Unknown command: ${command}`, 'Use: agent [context <area>|verify [--full]|eval <area>|learn] [--json] [--full]')
    if (json) console.error(JSON.stringify(payload))
    else console.error(`error: ${payload.error.message}\nrecovery: ${payload.error.recovery}`)
    return 2
  } catch (error) {
    const payload = errorPayload('INTERNAL_ERROR', error instanceof Error ? error.message : String(error), 'Inspect the repository state and rerun with --json.')
    if (json) console.error(JSON.stringify(payload))
    else console.error(`error: ${payload.error.message}\nrecovery: ${payload.error.recovery}`)
    return 1
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) process.exitCode = main()
