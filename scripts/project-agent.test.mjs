import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  boundPayload,
  buildDoctor,
  buildHome,
  contextAliases,
  contexts,
  listLearnings,
  main,
  validateContextManifest,
} from './project-agent.mjs'

const cwd = process.cwd()

function silently(operation) {
  const originalLog = console.log
  const originalError = console.error
  console.log = () => {}
  console.error = () => {}
  try {
    return operation()
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

describe('project-agent', () => {
  it('builds a compact live payload from leases instead of the legacy board', () => {
    const payload = buildHome(cwd)
    assert.equal(payload.schemaVersion, 2)
    assert.equal(payload.project, 'fixflags')
    assert.equal(typeof payload.state.changedFileCount, 'number')
    assert.equal(typeof payload.state.ownership.activeCount, 'number')
    assert.ok(Array.isArray(payload.state.ownership.current))
    assert.ok(Array.isArray(payload.recommendations))
    assert.ok(payload.next.length > 0)
  })

  it('bounds default collections and preserves totals', () => {
    const payload = { state: { changedFiles: Array.from({ length: 15 }, (_, index) => `file-${index}`), ownership: { current: [], conflicts: [], expired: [] } }, recommendations: [] }
    const result = boundPayload(payload, false)
    assert.equal(result.state.changedFiles.items.length, 10)
    assert.equal(result.state.changedFiles.total, 15)
    assert.equal(result.state.changedFiles.truncated, true)
  })

  it('does not truncate with full output', () => {
    const payload = { state: { changedFiles: Array.from({ length: 15 }, (_, index) => `file-${index}`), ownership: { current: [], conflicts: [], expired: [] } }, recommendations: [] }
    const result = boundPayload(payload, true)
    assert.equal(result.state.changedFiles.items.length, 15)
    assert.equal(result.state.changedFiles.truncated, false)
  })

  it('loads the focused context manifest with at most five attributed sources', () => {
    assert.deepEqual(Object.keys(contexts).sort(), [
      'audit', 'auth-billing', 'cli', 'docs', 'growth', 'orientation', 'outcomes', 'product', 'prompts', 'release', 'security', 'ui',
    ])
    for (const context of Object.values(contexts)) {
      assert.ok(context.sources.length > 0 && context.sources.length <= 5)
      assert.ok(context.sources.every((source) => source.path && source.authority && source.reason && source.status !== 'historical'))
    }
    assert.equal(contextAliases.interface, 'ui')
    assert.equal(contextAliases.billing, 'auth-billing')
    assert.deepEqual(validateContextManifest(cwd), { ok: true, errors: [], areaCount: 12 })
  })

  it('accepts context aliases and returns usage errors for unknown input', () => {
    silently(() => {
      assert.equal(main(['context', 'interface', '--json'], cwd), 0)
      assert.equal(main(['context', 'billing', '--json'], cwd), 0)
      assert.equal(main(['unknown', '--json'], cwd), 2)
      assert.equal(main(['context', 'missing', '--json'], cwd), 2)
    })
  })

  it('plans verification without executing it', () => {
    silently(() => assert.equal(main(['verify', '--dry-run', '--json'], cwd), 0))
  })

  it('keeps default orientation output below 500 whitespace tokens', () => {
    const result = spawnSync(process.execPath, ['scripts/project-agent.mjs'], { cwd, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.stdout.trim().split(/\s+/).length < 500)
  })

  it('enforces the focused repository harness policy', () => {
    const doctor = buildDoctor(cwd)
    assert.equal(doctor.status, 'passed', JSON.stringify(doctor.checks.filter((check) => !check.ok), null, 2))
    assert.deepEqual(doctor.checks.map((check) => check.name), [
      'instruction-budget',
      'context-manifest',
      'routed-metadata',
      'route-isolation',
      'current-authority',
      'optional-tools',
      'customer-integrations',
      'telemetry-privacy',
      'harness-naming',
      'lease-store',
    ])
  })

  it('lists scoped local learnings without requiring archived records', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'fixflags-agent-learnings-'))
    try {
      assert.deepEqual(listLearnings(fixture), [])
      const directory = join(fixture, '.agents/learnings')
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, 'README.md'), '# Local evidence conventions\n')
      assert.deepEqual(listLearnings(fixture), [])
      writeFileSync(join(directory, 'validated-observation.md'), '# Validated observation\n')
      const learnings = listLearnings(fixture)
      assert.equal(learnings.length, 1)
      assert.equal(learnings[0].id, 'validated-observation')
      assert.equal(learnings[0].title, 'Validated observation')
      assert.ok(Number.isFinite(Date.parse(learnings[0].updatedAt)))
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })
})
