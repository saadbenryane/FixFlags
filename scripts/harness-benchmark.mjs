#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const tasks = ['orientation', 'docs-only', 'report-ui', 'audit-pipeline', 'prompts', 'billing', 'public-cli', 'failure-recovery']

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function validateRecord(record) {
  const errors = []
  if (!tasks.includes(record.taskId)) errors.push(`taskId must be one of: ${tasks.join(', ')}`)
  if (!['baseline', 'axi'].includes(record.condition)) errors.push('condition must be baseline or axi')
  if (![1, 2, 3].includes(record.repetition)) errors.push('repetition must be 1, 2, or 3')
  for (const key of ['model', 'harness', 'promptHash', 'fixtureHash']) if (!record[key]) errors.push(`${key} is required`)
  if (typeof record.success !== 'boolean') errors.push('success must be boolean')
  for (const key of ['durationMs', 'toolTurns']) if (!Number.isFinite(record[key]) || record[key] < 0) errors.push(`${key} must be a non-negative number`)
  for (const key of ['inputTokens', 'outputTokens']) if (record[key] != null && (!Number.isInteger(record[key]) || record[key] < 0)) errors.push(`${key} must be a non-negative integer or null`)
  return errors
}

export function summarize(records) {
  const summary = {}
  for (const condition of ['baseline', 'axi']) {
    const rows = records.filter((record) => record.condition === condition)
    const tokenRows = rows.filter((record) => record.inputTokens != null && record.outputTokens != null)
    summary[condition] = {
      runs: rows.length,
      taskCoverage: new Set(rows.map((row) => row.taskId)).size,
      successRate: rows.length ? rows.filter((row) => row.success).length / rows.length : null,
      medianDurationMs: median(rows.map((row) => row.durationMs)),
      medianToolTurns: median(rows.map((row) => row.toolTurns)),
      medianTokens: median(tokenRows.map((row) => row.inputTokens + row.outputTokens)),
      tokenTelemetryRuns: tokenRows.length,
    }
  }
  const complete = ['baseline', 'axi'].every((condition) => tasks.every((taskId) => records.filter((row) => row.condition === condition && row.taskId === taskId).length >= 3))
  const baseline = summary.baseline; const axi = summary.axi
  const tokenImprovement = baseline.medianTokens && axi.medianTokens != null ? (baseline.medianTokens - axi.medianTokens) / baseline.medianTokens : null
  const turnImprovement = baseline.medianToolTurns && axi.medianToolTurns != null ? (baseline.medianToolTurns - axi.medianToolTurns) / baseline.medianToolTurns : null
  return {
    project: 'qewos',
    complete,
    summary,
    improvements: { tokens: tokenImprovement, toolTurns: turnImprovement },
    acceptance: complete && axi.successRate >= baseline.successRate && (tokenImprovement >= 0.2 || turnImprovement >= 0.2) ? 'candidate-pass' : complete ? 'failed' : 'insufficient-telemetry',
  }
}

export function readRecords(file) {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function main(argv = process.argv.slice(2)) {
  const action = argv[0] || 'report'
  const file = path.resolve(process.cwd(), '.agents/evals/harness/runs.jsonl')
  if (action === 'tasks') { console.log(JSON.stringify({ project: 'qewos', repetitions: 3, tasks }, null, 2)); return 0 }
  if (action === 'record') {
    const input = argv[1] === '-' || !argv[1] ? readFileSync(0, 'utf8') : readFileSync(path.resolve(argv[1]), 'utf8')
    const record = { ...JSON.parse(input), recordedAt: new Date().toISOString() }
    const errors = validateRecord(record)
    if (errors.length) { console.error(JSON.stringify({ error: 'INVALID_RECORD', details: errors })); return 2 }
    appendFileSync(file, `${JSON.stringify(record)}\n`)
    console.log(JSON.stringify({ recorded: true, taskId: record.taskId, condition: record.condition, repetition: record.repetition }))
    return 0
  }
  if (action === 'report') { console.log(JSON.stringify(summarize(readRecords(file)), null, 2)); return 0 }
  console.error(JSON.stringify({ error: 'UNKNOWN_COMMAND', recovery: 'Use tasks, record [file|-], or report' })); return 2
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (direct) process.exitCode = main()
