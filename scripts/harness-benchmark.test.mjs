import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { summarize, tasks, validateRecord } from './harness-benchmark.mjs'

function record(taskId, condition, repetition, overrides = {}) {
  return { taskId, condition, repetition, model: 'same-model', harness: 'codex', promptHash: 'prompt', fixtureHash: 'fixture', success: true, durationMs: condition === 'axi' ? 80 : 100, toolTurns: condition === 'axi' ? 4 : 5, inputTokens: condition === 'axi' ? 800 : 1000, outputTokens: condition === 'axi' ? 80 : 100, ...overrides }
}

describe('qewos harness benchmark', () => {
  it('keeps unavailable token telemetry null', () => { assert.deepEqual(validateRecord(record('orientation', 'axi', 1, { inputTokens: null, outputTokens: null })), []) })
  it('rejects estimated or malformed telemetry', () => { assert.ok(validateRecord(record('orientation', 'axi', 1, { inputTokens: 'about 100' })).length) })
  it('requires all tasks and repetitions before acceptance', () => { assert.equal(summarize([record('orientation', 'baseline', 1)]).acceptance, 'insufficient-telemetry') })
  it('passes a complete measured 20 percent improvement candidate', () => { const rows = []; for (const taskId of tasks) for (const condition of ['baseline', 'axi']) for (const repetition of [1, 2, 3]) rows.push(record(taskId, condition, repetition)); assert.equal(summarize(rows).acceptance, 'candidate-pass') })
})
