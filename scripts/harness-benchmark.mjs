#!/usr/bin/env node

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const tasks = [
  'localized-implementation',
  'site-ui',
  'audit-or-outcomes',
  'security-sensitive',
  'stale-document-conflict',
  'concurrent-ownership',
]

const conditions = ['baseline', 'candidate']
const forbiddenPayloadKeys = ['prompt', 'response', 'source', 'output', 'transcript']

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function improvement(before, after) {
  return before > 0 && after != null ? (before - after) / before : null
}

export function validateRecord(record) {
  const errors = []
  if (!tasks.includes(record.taskId)) errors.push(`taskId must be one of: ${tasks.join(', ')}`)
  if (!conditions.includes(record.condition)) errors.push('condition must be baseline or candidate')
  if (record.repetition !== 1) errors.push('repetition must be 1; repeat only a documented anomaly as a separate investigation')
  for (const key of ['model', 'reasoningEffort', 'speed', 'harness', 'promptHash', 'fixtureHash']) {
    if (!record[key]) errors.push(`${key} is required`)
  }
  if (record.speed !== 'standard') errors.push('speed must be standard')
  if (typeof record.success !== 'boolean') errors.push('success must be boolean')
  if (typeof record.authorityCorrect !== 'boolean') errors.push('authorityCorrect must be boolean')
  if (typeof record.unnecessaryFullSuite !== 'boolean') errors.push('unnecessaryFullSuite must be boolean')
  for (const key of ['durationMs', 'toolTurns', 'sourcesOpened', 'userCorrections', 'archiveReads', 'optionalToolsStarted', 'coordinationConflicts']) {
    if (!Number.isFinite(record[key]) || record[key] < 0) errors.push(`${key} must be a non-negative number`)
  }
  for (const key of ['inputTokens', 'cachedInputTokens', 'outputTokens']) {
    if (record[key] != null && (!Number.isInteger(record[key]) || record[key] < 0)) errors.push(`${key} must be a non-negative integer or null`)
  }
  if (record.cachedInputTokens != null && record.inputTokens != null && record.cachedInputTokens > record.inputTokens) {
    errors.push('cachedInputTokens cannot exceed inputTokens')
  }
  if (record.credits != null && (!Number.isFinite(record.credits) || record.credits < 0)) errors.push('credits must be a non-negative number or null')
  for (const key of forbiddenPayloadKeys) if (Object.hasOwn(record, key)) errors.push(`${key} must not be recorded; store hashes and aggregate metrics only`)
  return errors
}

export function summarize(records) {
  const summary = {}
  for (const condition of conditions) {
    const rows = records.filter((record) => record.condition === condition)
    const tokenRows = rows.filter((record) => record.inputTokens != null && record.outputTokens != null)
    const cacheRows = rows.filter((record) => record.inputTokens > 0 && record.cachedInputTokens != null)
    const creditRows = rows.filter((record) => record.credits != null)
    summary[condition] = {
      runs: rows.length,
      taskCoverage: new Set(rows.map((row) => row.taskId)).size,
      successRate: rows.length ? rows.filter((row) => row.success).length / rows.length : null,
      medianDurationMs: median(rows.map((row) => row.durationMs)),
      medianToolTurns: median(rows.map((row) => row.toolTurns)),
      medianTokens: median(tokenRows.map((row) => row.inputTokens + row.outputTokens)),
      medianCredits: median(creditRows.map((row) => row.credits)),
      medianCacheRatio: median(cacheRows.map((row) => row.cachedInputTokens / row.inputTokens)),
      medianSourcesOpened: median(rows.map((row) => row.sourcesOpened)),
      userCorrections: rows.reduce((total, row) => total + row.userCorrections, 0),
      policyViolations: rows.reduce((total, row) => total
        + Number(!row.authorityCorrect)
        + Number(row.unnecessaryFullSuite)
        + row.archiveReads
        + row.optionalToolsStarted, 0),
      tokenTelemetryRuns: tokenRows.length,
      creditTelemetryRuns: creditRows.length,
    }
  }

  const complete = conditions.every((condition) => tasks.every((taskId) =>
    records.some((row) => row.condition === condition && row.taskId === taskId && row.repetition === 1)))
  const baseline = summary.baseline
  const candidate = summary.candidate
  const tokenImprovement = improvement(baseline.medianTokens, candidate.medianTokens)
  const turnImprovement = improvement(baseline.medianToolTurns, candidate.medianToolTurns)
  const accepted = complete
    && candidate.successRate >= baseline.successRate
    && candidate.policyViolations === 0
    && (tokenImprovement >= 0.2 || turnImprovement >= 0.2)

  return {
    project: 'fixflags',
    complete,
    summary,
    improvements: { tokens: tokenImprovement, toolTurns: turnImprovement },
    acceptance: accepted ? 'candidate-pass' : complete ? 'failed' : 'insufficient-telemetry',
  }
}

export function readRecords(file) {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function main(argv = process.argv.slice(2)) {
  const action = argv[0] || 'report'
  const file = path.resolve(process.cwd(), '.agents/evals/harness/runs.jsonl')
  if (action === 'tasks') {
    console.log(JSON.stringify({ project: 'fixflags', model: 'gpt-6.1-sol', reasoningEffort: 'medium', speed: 'standard', repetitions: 1, tasks }, null, 2))
    return 0
  }
  if (action === 'record') {
    const input = argv[1] === '-' || !argv[1] ? readFileSync(0, 'utf8') : readFileSync(path.resolve(argv[1]), 'utf8')
    const record = { ...JSON.parse(input), recordedAt: new Date().toISOString() }
    const errors = validateRecord(record)
    if (errors.length) { console.error(JSON.stringify({ error: 'INVALID_RECORD', details: errors })); return 2 }
    mkdirSync(path.dirname(file), { recursive: true })
    appendFileSync(file, `${JSON.stringify(record)}\n`, { mode: 0o600 })
    console.log(JSON.stringify({ recorded: true, taskId: record.taskId, condition: record.condition, repetition: record.repetition }))
    return 0
  }
  if (action === 'report') { console.log(JSON.stringify(summarize(readRecords(file)), null, 2)); return 0 }
  console.error(JSON.stringify({ error: 'UNKNOWN_COMMAND', recovery: 'Use tasks, record [file|-], or report' }))
  return 2
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (direct) process.exitCode = main()
