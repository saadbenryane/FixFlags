import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseLegacyBoard } from './migrate-agent-board.mjs'

describe('legacy board migration', () => {
  it('preserves current and completed table shapes', () => {
    const result = parseLegacyBoard(`
| Task ID | Status | Owner | Branch/worktree | Scope | Files/areas | Dependencies | Updated |
| --- | --- | --- | --- | --- | --- | --- | --- |
| current-task | in-progress | agent-a | main | Current scope | scripts/ | None | 2026-10-09 |
| Task ID | Owner | Scope | Completed |
| --- | --- | --- | --- |
| old-task | agent-b | Old scope | 2026-08-20 |
`)
    assert.equal(result.warnings.length, 0)
    assert.equal(result.records.length, 2)
    assert.equal(result.records[1].status, 'done')
  })

  it('folds unescaped dependency pipes and preserves dates without a trailing delimiter', () => {
    const result = parseLegacyBoard('| malformed-old-row | review | agent-a | main | scope | scripts/ | left | right | 2026-09-27')
    assert.equal(result.warnings.length, 0)
    assert.equal(result.records[0].dependencies, 'left | right')
    assert.equal(result.records[0].updatedAt, '2026-09-27')
  })

  it('reports rows that cannot be migrated deterministically', () => {
    const result = parseLegacyBoard('| too | few | cells | here | extra |')
    assert.equal(result.records.length, 0)
    assert.equal(result.warnings.length, 1)
    assert.match(result.warnings[0].message, /Expected 4 or at least 8 cells/)
  })
})
