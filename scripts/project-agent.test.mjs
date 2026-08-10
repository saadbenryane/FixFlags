import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { boundPayload, buildHome, contexts, listLearnings, main } from './project-agent.mjs'

const cwd = process.cwd()

describe('project-agent', () => {
  it('builds a live home payload with explicit state', () => {
    const payload = buildHome(cwd)
    assert.equal(payload.schemaVersion, 1)
    assert.equal(payload.project, 'fixflags')
    assert.equal(typeof payload.state.changedFileCount, 'number')
    assert.ok(Array.isArray(payload.recommendations))
    assert.ok(payload.next.length > 0)
  })

  it('bounds default collections and preserves totals', () => {
    const payload = { state: { changedFiles: Array.from({ length: 15 }, (_, index) => `file-${index}`), ownership: { active: [] } }, recommendations: [] }
    const result = boundPayload(payload, false)
    assert.equal(result.state.changedFiles.items.length, 10)
    assert.equal(result.state.changedFiles.total, 15)
    assert.equal(result.state.changedFiles.truncated, true)
  })

  it('does not truncate with full output', () => {
    const payload = { state: { changedFiles: Array.from({ length: 15 }, (_, index) => `file-${index}`), ownership: { active: [] } }, recommendations: [] }
    const result = boundPayload(payload, true)
    assert.equal(result.state.changedFiles.items.length, 15)
    assert.equal(result.state.changedFiles.truncated, false)
  })

  it('exposes focused product and operational contexts', () => {
    assert.deepEqual(Object.keys(contexts).sort(), [
      'accuracy', 'audit', 'auth', 'billing', 'cli', 'docs', 'growth', 'orientation', 'prompts',
      'recovery', 'release', 'security', 'ui',
    ])
  })

  it('returns usage exit code for unknown commands and contexts', () => {
    assert.equal(main(['unknown', '--json'], cwd), 2)
    assert.equal(main(['context', 'missing', '--json'], cwd), 2)
  })

  it('plans verification without executing it', () => {
    assert.equal(main(['verify', '--dry-run', '--json'], cwd), 0)
  })

  it('lists real validated learnings', () => {
    const learnings = listLearnings(cwd)
    assert.ok(learnings.length > 0)
    assert.ok(learnings.every((item) => item.id && item.title && item.updatedAt))
  })
})
