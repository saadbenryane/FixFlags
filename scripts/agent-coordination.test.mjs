import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import {
  LEASE_DURATION_MS,
  claimLease,
  coordinationPaths,
  finishLease,
  heartbeatLease,
  inspectOwnership,
  listLeases,
  recordTaskHistory,
  releaseLease,
  validateLeaseStore,
} from './agent-coordination.mjs'

const temporaryDirectories = []

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function repository() {
  const root = mkdtempSync(path.join(tmpdir(), 'fixflags-agent-coordination-'))
  temporaryDirectories.push(root)
  git(root, 'init', '-q')
  git(root, 'config', 'user.email', 'agent-test@example.com')
  git(root, 'config', 'user.name', 'Agent Test')
  writeFileSync(path.join(root, 'README.md'), '# fixture\n')
  git(root, 'add', 'README.md')
  git(root, 'commit', '-qm', 'fixture')
  return root
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('agent coordination leases', () => {
  it('shares leases across worktrees and warns on overlapping paths', () => {
    const root = repository()
    const second = `${root}-worktree`
    temporaryDirectories.push(second)
    git(root, 'worktree', 'add', '-q', '-b', 'other-worktree', second)
    const first = claimLease(root, { taskId: 'task-one', owner: 'agent-a', scope: 'project agent', relatedPaths: ['scripts/'] })
    assert.equal(first.conflicts.length, 0)
    const fromSecond = inspectOwnership(second)
    assert.equal(fromSecond.activeCount, 1)
    assert.equal(fromSecond.current.length, 0)
    const overlapping = claimLease(second, { taskId: 'task-two', owner: 'agent-b', scope: 'other work', relatedPaths: ['scripts/project-agent.mjs'] })
    assert.equal(overlapping.conflicts.length, 1)
    assert.match(overlapping.conflicts[0].reasons.join(' '), /overlapping path/)
  })

  it('heartbeats for 24 hours and requires an explicit reason to reclaim expiry', () => {
    const root = repository()
    const started = new Date('2026-10-09T10:00:00.000Z')
    const claimed = claimLease(root, { taskId: 'lease-expiry', owner: 'agent-a', scope: 'lease test', relatedPaths: [] }, { now: started }).lease
    assert.equal(Date.parse(claimed.expiresAt) - Date.parse(claimed.updatedAt), LEASE_DURATION_MS)
    const renewedAt = new Date('2026-10-09T20:00:00.000Z')
    const renewed = heartbeatLease(root, 'lease-expiry', 'agent-a', { now: renewedAt })
    assert.equal(renewed.status, 'in_progress')
    assert.equal(Date.parse(renewed.expiresAt) - Date.parse(renewed.updatedAt), LEASE_DURATION_MS)
    const expiredAt = new Date('2026-10-11T00:00:00.000Z')
    assert.equal(listLeases(root, { now: expiredAt }).leases[0].expired, true)
    assert.throws(() => claimLease(root, { taskId: 'lease-expiry', owner: 'agent-b', scope: 'new owner', relatedPaths: [] }, { now: expiredAt }), /--reclaim/)
    const reclaimed = claimLease(root, { taskId: 'lease-expiry', owner: 'agent-b', scope: 'new owner', relatedPaths: [], reclaimReason: 'Prior owner stopped responding.' }, { now: expiredAt })
    assert.equal(reclaimed.lease.owner, 'agent-b')
  })

  it('enforces owner identity for heartbeat, finish, and release', () => {
    const root = repository()
    claimLease(root, { taskId: 'owned-task', owner: 'agent-a', scope: 'owner test', relatedPaths: [] })
    assert.throws(() => heartbeatLease(root, 'owned-task', 'agent-b'), /leased by agent-a/)
    assert.throws(() => finishLease(root, 'owned-task', 'agent-b'), /leased by agent-a/)
    assert.equal(releaseLease(root, 'owned-task', 'agent-a').taskId, 'owned-task')
    assert.equal(inspectOwnership(root).activeCount, 0)
  })

  it('writes a concise per-task history only when a summary is supplied', () => {
    const root = repository()
    const lease = claimLease(root, { taskId: 'durable-task', title: 'Durable task', owner: 'agent-a', scope: 'history test', relatedPaths: [] }).lease
    assert.equal(recordTaskHistory(root, lease, { summary: '', evidence: [] }), null)
    const file = recordTaskHistory(root, lease, { summary: 'Finished the coordination test.', evidence: ['node --test passed'] })
    assert.equal(file, '.agents/history/tasks/durable-task.md')
    assert.match(readFileSync(path.join(root, file), 'utf8'), /node --test passed/)
    assert.throws(() => recordTaskHistory(root, lease, { summary: 'Do not overwrite.', evidence: [] }), /EEXIST/)
  })

  it('reports malformed lease files without hiding valid leases', () => {
    const root = repository()
    claimLease(root, { taskId: 'valid-task', owner: 'agent-a', scope: 'valid', relatedPaths: [] })
    const paths = coordinationPaths(root)
    writeFileSync(path.join(paths.leases, 'malformed.json'), '{not json')
    const result = validateLeaseStore(root)
    assert.equal(result.ok, false)
    assert.equal(result.active, 1)
    assert.equal(result.warnings.length, 1)
  })

  it('recovers a stale mutation lock left by an interrupted process', () => {
    const root = repository()
    const paths = coordinationPaths(root)
    mkdirSync(paths.lock, { recursive: true })
    const old = new Date(Date.now() - 60_000)
    utimesSync(paths.lock, old, old)
    const result = claimLease(root, { taskId: 'after-crash', owner: 'agent-a', scope: 'recover lock', relatedPaths: [] })
    assert.equal(result.lease.taskId, 'after-crash')
  })
})
