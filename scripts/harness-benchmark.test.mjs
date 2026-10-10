import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { summarize, tasks, validateRecord } from './harness-benchmark.mjs'

function record(taskId, condition, overrides = {}) {
  return {
    taskId,
    condition,
    repetition: 1,
    model: 'gpt-6.1-sol',
    reasoningEffort: 'medium',
    speed: 'standard',
    harness: 'codex',
    promptHash: 'prompt',
    fixtureHash: 'fixture',
    success: true,
    authorityCorrect: true,
    unnecessaryFullSuite: false,
    durationMs: condition === 'candidate' ? 80 : 100,
    toolTurns: condition === 'candidate' ? 4 : 5,
    sourcesOpened: condition === 'candidate' ? 3 : 5,
    userCorrections: 0,
    archiveReads: 0,
    optionalToolsStarted: 0,
    coordinationConflicts: 0,
    inputTokens: condition === 'candidate' ? 800 : 1000,
    cachedInputTokens: condition === 'candidate' ? 400 : 400,
    outputTokens: condition === 'candidate' ? 80 : 100,
    credits: null,
    ...overrides,
  }
}

describe('FixFlags harness benchmark', () => {
  it('keeps unavailable usage telemetry null', () => {
    assert.deepEqual(validateRecord(record('localized-implementation', 'candidate', {
      inputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
    })), [])
  })

  it('rejects malformed telemetry and raw content', () => {
    assert.ok(validateRecord(record('localized-implementation', 'candidate', { inputTokens: 'about 100' })).length)
    assert.ok(validateRecord(record('localized-implementation', 'candidate', { prompt: 'raw prompt' })).length)
    assert.ok(validateRecord(record('localized-implementation', 'candidate', { speed: 'fast' })).length)
  })

  it('requires one measured run for every task and condition', () => {
    assert.equal(summarize([record('localized-implementation', 'baseline')]).acceptance, 'insufficient-telemetry')
  })

  it('passes a complete candidate with no policy violations and 20 percent improvement', () => {
    const rows = []
    for (const taskId of tasks) for (const condition of ['baseline', 'candidate']) rows.push(record(taskId, condition))
    assert.equal(summarize(rows).acceptance, 'candidate-pass')
  })

  it('rejects a cheaper candidate that reads archives or selects optional tools', () => {
    const rows = []
    for (const taskId of tasks) for (const condition of ['baseline', 'candidate']) {
      rows.push(record(taskId, condition, condition === 'candidate' && taskId === tasks[0] ? { archiveReads: 1, optionalToolsStarted: 1 } : {}))
    }
    assert.equal(summarize(rows).acceptance, 'failed')
  })
})
