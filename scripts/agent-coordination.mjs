import { spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

export const LEASE_DURATION_MS = 24 * 60 * 60 * 1000
const LEASE_SCHEMA_VERSION = 1
const TASK_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,119}$/
const STALE_MUTATION_LOCK_MS = 30_000

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`)
  return result.stdout.trim()
}

export function resolveGitCommonDir(cwd) {
  const value = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  return path.normalize(path.isAbsolute(value) ? value : path.resolve(cwd, value))
}

export function resolveWorktree(cwd) {
  return path.normalize(git(cwd, ['rev-parse', '--show-toplevel']))
}

export function coordinationPaths(cwd) {
  const commonDir = resolveGitCommonDir(cwd)
  const root = path.join(commonDir, 'fixflags-agent')
  return {
    commonDir,
    root,
    leases: path.join(root, 'leases'),
    reclaimed: path.join(root, 'reclaimed'),
    lock: path.join(root, 'mutation.lock'),
  }
}

function ensureDirectories(paths) {
  mkdirSync(paths.leases, { recursive: true })
  mkdirSync(paths.reclaimed, { recursive: true })
}

function requireTaskId(taskId) {
  if (!TASK_ID_PATTERN.test(taskId || '')) {
    throw new Error('Task id must be 2-120 characters using lowercase letters, numbers, dot, underscore, or hyphen.')
  }
  return taskId
}

function leaseFile(paths, taskId) {
  return path.join(paths.leases, `${requireTaskId(taskId)}.json`)
}

function iso(now) {
  return new Date(now).toISOString()
}

function addLeaseDuration(now) {
  return new Date(new Date(now).getTime() + LEASE_DURATION_MS).toISOString()
}

function normalizeRelatedPath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

function normalizePaths(values = []) {
  return [...new Set(values.map((value) => normalizeRelatedPath(value.trim())).filter(Boolean))].sort()
}

function isExpired(lease, now) {
  return Number.isNaN(Date.parse(lease.expiresAt)) || Date.parse(lease.expiresAt) <= new Date(now).getTime()
}

function validateLeaseShape(value) {
  const errors = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['lease must be a JSON object']
  if (value.schemaVersion !== LEASE_SCHEMA_VERSION) errors.push(`unsupported schemaVersion ${String(value.schemaVersion)}`)
  if (!TASK_ID_PATTERN.test(value.taskId || '')) errors.push('invalid taskId')
  for (const field of ['title', 'owner', 'scope', 'worktree', 'status', 'createdAt', 'updatedAt', 'expiresAt']) {
    if (typeof value[field] !== 'string' || value[field].trim() === '') errors.push(`missing ${field}`)
  }
  if (!Array.isArray(value.relatedPaths) || value.relatedPaths.some((item) => typeof item !== 'string')) errors.push('relatedPaths must be an array of strings')
  for (const field of ['createdAt', 'updatedAt', 'expiresAt']) {
    if (value[field] && Number.isNaN(Date.parse(value[field]))) errors.push(`invalid ${field}`)
  }
  return errors
}

function readLeaseFile(file) {
  const value = JSON.parse(readFileSync(file, 'utf8'))
  const errors = validateLeaseShape(value)
  if (errors.length > 0) throw new Error(errors.join(', '))
  return value
}

function withMutationLock(paths, operation) {
  ensureDirectories(paths)
  let acquired = false
  for (let attempt = 0; attempt < 2 && !acquired; attempt += 1) {
    try {
      mkdirSync(paths.lock)
      acquired = true
      try {
        writeFileSync(path.join(paths.lock, 'owner.json'), `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`, { mode: 0o600 })
      } catch (error) {
        rmSync(paths.lock, { recursive: true, force: true })
        throw error
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      const age = Date.now() - statSync(paths.lock).mtimeMs
      if (attempt === 0 && age > STALE_MUTATION_LOCK_MS) rmSync(paths.lock, { recursive: true, force: true })
      else throw new Error('Another task lease mutation is in progress; retry shortly.')
    }
  }
  try {
    return operation()
  } finally {
    rmSync(paths.lock, { recursive: true, force: true })
  }
}

function atomicReplace(file, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  renameSync(temporary, file)
}

function pathsOverlap(left, right) {
  if (!left || !right) return false
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)
}

export function leaseOverlap(left, right) {
  const sharedPaths = left.relatedPaths.flatMap((leftPath) => right.relatedPaths.filter((rightPath) => pathsOverlap(leftPath, rightPath)))
  const sameScope = left.scope.trim().toLowerCase() === right.scope.trim().toLowerCase()
  if (!sameScope && sharedPaths.length === 0) return null
  return {
    taskId: right.taskId,
    owner: right.owner,
    reasons: [
      ...(sameScope ? [`same scope: ${left.scope}`] : []),
      ...sharedPaths.map((item) => `overlapping path: ${item}`),
    ],
  }
}

export function listLeases(cwd, { now = new Date() } = {}) {
  const paths = coordinationPaths(cwd)
  ensureDirectories(paths)
  const leases = []
  const warnings = []
  for (const name of readdirSync(paths.leases).filter((item) => item.endsWith('.json')).sort()) {
    const file = path.join(paths.leases, name)
    try {
      const lease = readLeaseFile(file)
      leases.push({ ...lease, expired: isExpired(lease, now) })
    } catch (error) {
      warnings.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { paths, leases, warnings }
}

export function claimLease(cwd, input, { now = new Date() } = {}) {
  const taskId = requireTaskId(input.taskId)
  if (!input.owner?.trim()) throw new Error('Claim requires --owner <name>.')
  if (!input.scope?.trim()) throw new Error('Claim requires --scope <description>.')
  const paths = coordinationPaths(cwd)
  return withMutationLock(paths, () => {
    const file = leaseFile(paths, taskId)
    if (existsSync(file)) {
      const existing = readLeaseFile(file)
      if (!isExpired(existing, now)) throw new Error(`Task ${taskId} is already leased by ${existing.owner} until ${existing.expiresAt}.`)
      if (!input.reclaimReason?.trim()) throw new Error(`Task ${taskId} has an expired lease; reclaim it with --reclaim <reason>.`)
      const reclaimed = {
        ...existing,
        reclaimedAt: iso(now),
        reclaimedBy: input.owner.trim(),
        reclaimReason: input.reclaimReason.trim(),
      }
      atomicReplace(path.join(paths.reclaimed, `${taskId}-${new Date(now).getTime()}.json`), reclaimed)
      unlinkSync(file)
    }

    const lease = {
      schemaVersion: LEASE_SCHEMA_VERSION,
      taskId,
      title: input.title?.trim() || taskId,
      owner: input.owner.trim(),
      scope: input.scope.trim(),
      relatedPaths: normalizePaths(input.relatedPaths),
      worktree: resolveWorktree(cwd),
      status: 'claimed',
      createdAt: iso(now),
      updatedAt: iso(now),
      expiresAt: addLeaseDuration(now),
    }
    const current = listLeases(cwd, { now }).leases.filter((item) => !item.expired)
    const conflicts = current.map((item) => leaseOverlap(lease, item)).filter(Boolean)
    const descriptor = openSync(file, 'wx', 0o600)
    try {
      writeFileSync(descriptor, `${JSON.stringify(lease, null, 2)}\n`)
    } finally {
      closeSync(descriptor)
    }
    return { lease, conflicts }
  })
}

function mutateLease(cwd, taskId, owner, operation, { now = new Date() } = {}) {
  if (!owner?.trim()) throw new Error(`${operation} requires --owner <name>.`)
  const paths = coordinationPaths(cwd)
  return withMutationLock(paths, () => {
    const file = leaseFile(paths, taskId)
    if (!existsSync(file)) throw new Error(`No live lease exists for ${taskId}.`)
    const lease = readLeaseFile(file)
    if (lease.owner !== owner.trim()) throw new Error(`Task ${taskId} is leased by ${lease.owner}, not ${owner.trim()}.`)
    if (operation === 'heartbeat') {
      if (isExpired(lease, now)) throw new Error(`Task ${taskId} expired at ${lease.expiresAt}; reclaim it explicitly.`)
      const updated = { ...lease, status: 'in_progress', updatedAt: iso(now), expiresAt: addLeaseDuration(now) }
      atomicReplace(file, updated)
      return updated
    }
    unlinkSync(file)
    return lease
  })
}

export function heartbeatLease(cwd, taskId, owner, options) {
  return mutateLease(cwd, requireTaskId(taskId), owner, 'heartbeat', options)
}

export function finishLease(cwd, taskId, owner, options) {
  return mutateLease(cwd, requireTaskId(taskId), owner, 'finish', options)
}

export function releaseLease(cwd, taskId, owner, options) {
  return mutateLease(cwd, requireTaskId(taskId), owner, 'release', options)
}

function singleLine(value) {
  return value.replace(/\s+/g, ' ').trim()
}

export function recordTaskHistory(cwd, lease, { summary, evidence = [] }, { now = new Date() } = {}) {
  if (!summary?.trim()) return null
  const directory = path.join(cwd, '.agents/history/tasks')
  mkdirSync(directory, { recursive: true })
  const file = path.join(directory, `${requireTaskId(lease.taskId)}.md`)
  const evidenceLines = evidence.length > 0
    ? evidence.map((item) => `- ${singleLine(item)}`)
    : ['- No durable evidence reference was supplied.']
  const content = [
    `# ${singleLine(lease.title)}`,
    '',
    `- Task: \`${lease.taskId}\``,
    `- Owner: \`${singleLine(lease.owner)}\``,
    `- Scope: ${singleLine(lease.scope)}`,
    `- Worktree: \`${lease.worktree}\``,
    `- Started: ${lease.createdAt}`,
    `- Finished: ${iso(now)}`,
    '',
    '## Outcome',
    '',
    singleLine(summary),
    '',
    '## Evidence',
    '',
    ...evidenceLines,
    '',
  ].join('\n')
  writeFileSync(file, content, { flag: 'wx' })
  return path.relative(cwd, file)
}

export function inspectOwnership(cwd, { now = new Date() } = {}) {
  const worktree = resolveWorktree(cwd)
  const result = listLeases(cwd, { now })
  const current = result.leases.filter((item) => !item.expired && path.normalize(item.worktree) === worktree)
  const other = result.leases.filter((item) => !item.expired && path.normalize(item.worktree) !== worktree)
  const conflicts = current.flatMap((lease) => other.map((item) => leaseOverlap(lease, item)).filter(Boolean).map((conflict) => ({ currentTaskId: lease.taskId, ...conflict })))
  return {
    state: 'available',
    leaseDirectory: result.paths.leases,
    activeCount: result.leases.filter((item) => !item.expired).length,
    current,
    conflicts,
    expired: result.leases.filter((item) => item.expired),
    warnings: result.warnings,
  }
}

export function validateLeaseStore(cwd, options) {
  const result = listLeases(cwd, options)
  return {
    ok: result.warnings.length === 0,
    active: result.leases.filter((item) => !item.expired).length,
    expired: result.leases.filter((item) => item.expired).length,
    warnings: result.warnings,
    leaseDirectory: result.paths.leases,
  }
}
