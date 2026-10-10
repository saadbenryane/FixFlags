#!/usr/bin/env node
/**
 * FixFlags company readout — deterministic live-lease and goal state used by:
 *  - humans: `npm run agent:heartbeat` (tier-aware, compact)
 *  - scheduler/dispatch automation: `node scripts/agent-heartbeat.mjs --json`
 *
 * Live ownership comes from the shared Git-common-dir lease store. Historical
 * board rows and session archives are deliberately excluded.
 */

import fs from 'node:fs'
import path from 'node:path'
import { leaseOverlap, listLeases } from './agent-coordination.mjs'

const repoRoot = process.cwd()
const goalPath = path.join(repoRoot, '.agents', 'GOAL.md')

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function parseGoal(text) {
  if (!text) {
    return {
      status: 'unavailable',
      condition: 'unavailable',
      lastTurn: 'none',
      warning: 'GOAL.md is missing',
    }
  }

  const activeGoalSection = text.includes('## Active goal')
    ? text.slice(
        text.indexOf('## Active goal'),
        text.includes('## Achieved') ? text.indexOf('## Achieved') : text.length,
      )
    : text

  const statusMatch = activeGoalSection.match(/\| \*\*Status\*\* \|\s*([^|]+)\|/)
  const conditionMatch = activeGoalSection.match(/\| \*\*Condition\*\* \|\s*([^|]+)\|/)
  const turnRows = activeGoalSection
    .split('\n')
    .filter((line) => /^\|\s*\d+\s*\|/.test(line.trim()))
  const latestTurn = turnRows.at(-1) || 'none'
  const parts = `${latestTurn}`.split('|').map((value) => value.trim())
  const rawLastTurn = parts.length >= 3 ? parts[2] : `${latestTurn}`
  const lastTurn = rawLastTurn && rawLastTurn.length > 180
    ? `${rawLastTurn.slice(0, 177).trim()}…`
    : rawLastTurn
  const status = statusMatch?.[1]?.trim() || 'unavailable'
  const condition = conditionMatch?.[1]?.trim() || 'unavailable'
  const warning = status === 'unavailable' || condition === 'unavailable'
    ? 'GOAL.md is missing Active goal status/condition'
    : undefined

  return { status, lastTurn: lastTurn || 'none', condition, warning }
}

function formatLine(text) {
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeLease(lease) {
  return {
    id: lease.taskId,
    task: lease.title,
    status: lease.status === 'in_progress' ? 'in-progress' : lease.status,
    owner: lease.owner,
    scope: lease.scope,
    worktree: lease.worktree,
    relatedPaths: lease.relatedPaths,
    updated: lease.updatedAt,
    expiresAt: lease.expiresAt,
  }
}

function buildOwnership() {
  const result = listLeases(repoRoot)
  const liveLeases = result.leases.filter((lease) => !lease.expired)
  const active = liveLeases.map(normalizeLease)
  const expired = result.leases.filter((lease) => lease.expired).map(normalizeLease)
  const conflicts = []
  for (let leftIndex = 0; leftIndex < liveLeases.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < liveLeases.length; rightIndex += 1) {
      const overlap = leaseOverlap(liveLeases[leftIndex], liveLeases[rightIndex])
      if (overlap) conflicts.push({ currentTaskId: liveLeases[leftIndex].taskId, ...overlap })
    }
  }
  const counts = active.reduce((totals, lease) => {
    totals[lease.status] = (totals[lease.status] ?? 0) + 1
    return totals
  }, {})
  if (expired.length > 0) counts.expired = expired.length
  return {
    active,
    expired,
    conflicts,
    counts,
    warnings: result.warnings,
    leaseDirectory: result.leaseDirectory,
  }
}

function chooseNextAction(ownership) {
  return ownership.active.find((lease) => lease.status === 'in-progress')
    ?? ownership.active.find((lease) => lease.status === 'claimed')
    ?? ownership.expired[0]
    ?? null
}

function buildJson({ ownership, goal, next }) {
  const warnings = [
    ...ownership.warnings.map((message) => ({ type: 'lease_readout', message })),
    ...(goal.warning ? [{ type: 'goal_readout', message: goal.warning }] : []),
  ]
  const unresolvedWork = [
    ...ownership.expired.map((lease) => ({
      ...lease,
      actionHint: 'revalidate-or-reclaim',
      reason: `lease expired at ${lease.expiresAt}`,
    })),
    ...ownership.conflicts.map((conflict) => ({
      id: conflict.currentTaskId,
      task: `scope conflict with ${conflict.taskId}`,
      status: 'conflict',
      owner: conflict.owner,
      scope: conflict.reasons.join('; '),
      actionHint: 'coordinate-before-writing',
    })),
  ]
  if (unresolvedWork.length === 0) {
    unresolvedWork.push({
      id: 'none',
      task: 'no unresolved ownership work',
      status: 'none',
      owner: 'none',
      scope: 'none',
      actionHint: 'none',
      reason: 'no expired leases or direct conflicts found',
    })
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    ownership,
    goal,
    nextOwner: next ? { owner: next.owner, task: next.task, status: next.status } : null,
    warnings,
    fallbackReasons: warnings.map((warning) => ({
      source: warning.type === 'goal_readout' ? 'goal' : 'leases',
      reason: warning.message,
    })),
    unresolvedWork,
  }
}

function renderTier(tier, { ownership, goal, next }) {
  const lines = ['FixFlags Agentic Engine Heartbeat', '--------------------------------']
  const activeCount = ownership.active.length
  if (activeCount === 0 && ownership.expired.length === 0) {
    lines.push('status: noop')
    return lines.join('\n')
  }

  lines.push(
    `active leases: ${activeCount}`,
    `claimed: ${ownership.counts.claimed ?? 0}`,
    `in progress: ${ownership.counts['in-progress'] ?? 0}`,
    `expired: ${ownership.expired.length}`,
    `direct conflicts: ${ownership.conflicts.length}`,
  )

  if (tier === 'operational' || tier === 'daily') {
    lines.push('\nOwnership requiring attention:')
    const attention = [
      ...ownership.expired.map((lease) => `${lease.task} [expired] owner=${lease.owner}`),
      ...ownership.conflicts.map((conflict) => `${conflict.currentTaskId} conflicts with ${conflict.taskId} owner=${conflict.owner}`),
    ]
    lines.push(...(attention.length > 0 ? attention.slice(0, 6).map((item) => `  - ${item}`) : ['  none']))
  }

  if (tier === 'daily' || tier === 'weekly') {
    lines.push(`\nActive goal status: ${goal.status}`)
    lines.push(`Last logged turn: ${formatLine(goal.lastTurn)}`)
  }

  if (tier === 'weekly') {
    lines.push('\nLive ownership:')
    lines.push(...ownership.active.map((lease) => `  - ${lease.task} [${lease.status}] owner=${lease.owner} expires=${lease.expiresAt}`))
  }

  if (ownership.warnings.length > 0 || goal.warning) {
    lines.push('\nProvider notices:')
    for (const warning of ownership.warnings) lines.push(`  - lease readout: ${warning}`)
    if (goal.warning) lines.push(`  - goal readout: ${goal.warning}`)
  }

  if (next) {
    lines.push('\nNext owner action:', `  ${next.task} (${next.status})`, `  Owner: ${next.owner}`)
  } else {
    lines.push('\nNext owner action: none (no live or expired leases found)')
  }
  return lines.join('\n')
}

function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const tierArg = argv.find((argument) => argument.startsWith('--tier='))
  const tier = tierArg
    ? tierArg.split('=')[1]
    : argv.includes('--tier')
      ? argv[argv.indexOf('--tier') + 1]
      : null
  const tierName = ['operational', 'daily', 'weekly'].includes(tier) ? tier : 'operational'

  try {
    const ownership = buildOwnership()
    const goal = parseGoal(readFileSafe(goalPath))
    const next = chooseNextAction(ownership)
    if (asJson) console.log(JSON.stringify(buildJson({ ownership, goal, next }), null, 2))
    else console.log(renderTier(tierName, { ownership, goal, next }))
  } catch (error) {
    const message = `Could not read live leases: ${error instanceof Error ? error.message : String(error)}`
    if (asJson) console.error(JSON.stringify({ ok: false, error: message }))
    else console.error(message)
    process.exitCode = 1
  }
}

main()
