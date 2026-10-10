#!/usr/bin/env node
/** Unit tests for the deterministic live-lease heartbeat readout. */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-heartbeat.mjs')
let passed = 0
let failed = 0

function assert(condition, name, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ok   ${name}`)
  } else {
    failed += 1
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const FIXTURE_GOAL = `# Goal state

## Active goal

| Field | Value |
|-------|-------|
| **Condition** | Something complete. |
| **Status** | active |

## Turn log

| Turn | Work | Proof | Verdict | Reason |
|------|------|-------|---------|--------|
| 1 | Did a thing. | passed | PARTIAL | More to do. |
`

function git(cwd, args) {
  execFileSync('git', args, { cwd, stdio: 'ignore' })
}

function runReadout(cwd, args = []) {
  return execFileSync(process.execPath, [scriptPath, ...args], { cwd, encoding: 'utf8' })
}

function withFixture(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-readout-'))
  fs.mkdirSync(path.join(directory, '.agents'), { recursive: true })
  fs.writeFileSync(path.join(directory, '.agents', 'GOAL.md'), FIXTURE_GOAL)
  git(directory, ['init', '-q'])
  const leaseDirectory = path.join(directory, '.git', 'fixflags-agent', 'leases')
  fs.mkdirSync(leaseDirectory, { recursive: true })
  const now = Date.now()
  const leases = [
    {
      schemaVersion: 1,
      taskId: 'task-one',
      title: 'Task one',
      owner: 'agent-a',
      scope: 'Scope A',
      relatedPaths: ['files-a'],
      worktree: directory,
      status: 'in_progress',
      createdAt: new Date(now - 3_600_000).toISOString(),
      updatedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 86_400_000).toISOString(),
    },
    {
      schemaVersion: 1,
      taskId: 'task-two',
      title: 'Task two',
      owner: 'agent-b',
      scope: 'Scope B',
      relatedPaths: ['files-b'],
      worktree: directory,
      status: 'claimed',
      createdAt: new Date(now - 172_800_000).toISOString(),
      updatedAt: new Date(now - 172_800_000).toISOString(),
      expiresAt: new Date(now - 86_400_000).toISOString(),
    },
  ]
  for (const lease of leases) {
    fs.writeFileSync(path.join(leaseDirectory, `${lease.taskId}.json`), `${JSON.stringify(lease, null, 2)}\n`)
  }
  try {
    return callback(directory, leaseDirectory)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

withFixture((directory) => {
  const output = JSON.parse(runReadout(directory, ['--json']))
  assert(output.ok === true, 'json: ok flag')
  assert(output.ownership.counts['in-progress'] === 1, 'json: active lease count')
  assert(output.ownership.expired.length === 1 && output.ownership.expired[0].id === 'task-two', 'json: expired lease surfaced')
  assert(output.goal.status === 'active' && output.goal.condition.includes('Something complete'), 'json: goal status and condition')
  assert(output.goal.lastTurn.includes('Did a thing'), 'json: last logged turn captured')
  assert(output.nextOwner?.task === 'Task one' && output.nextOwner.owner === 'agent-a', 'json: live in-progress lease is next owner')
  assert(output.unresolvedWork[0].actionHint === 'revalidate-or-reclaim', 'json: expired lease requires explicit action')

  const weekly = runReadout(directory, ['--tier=weekly'])
  assert(weekly.includes('active leases: 1') && weekly.includes('expired: 1'), 'human: live and expired counts')
  assert(weekly.includes('Active goal status: active'), 'human: goal line in weekly tier')
  assert(weekly.includes('Task one [in-progress] owner=agent-a'), 'human: live ownership details')
})

withFixture((directory, leaseDirectory) => {
  fs.writeFileSync(path.join(leaseDirectory, 'bad.json'), '{not json')
  const output = JSON.parse(runReadout(directory, ['--json']))
  assert(output.warnings.some((warning) => warning.type === 'lease_readout'), 'json: malformed lease warning surfaced')
})

withFixture((directory) => {
  fs.unlinkSync(path.join(directory, '.agents', 'GOAL.md'))
  const output = JSON.parse(runReadout(directory, ['--json']))
  assert(output.goal.status === 'unavailable', 'json: missing GOAL.md is explicit')
  assert(output.goal.warning === 'GOAL.md is missing', 'json: missing GOAL.md warning present')
})

const outsideGit = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-readout-no-git-'))
try {
  let failure = ''
  try {
    runReadout(outsideGit, ['--json'])
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  assert(failure.includes('Could not read live leases'), 'json: missing Git lease store exits with explicit failure')
} finally {
  fs.rmSync(outsideGit, { recursive: true, force: true })
}

console.log(`\nagent-heartbeat: ${passed} passed, ${failed} failed`)
process.exitCode = failed > 0 ? 1 : 0
