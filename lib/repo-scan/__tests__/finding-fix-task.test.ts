import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { buildRepoFindingFixTask } from '@/lib/repo-scan/finding-fix-task'

const baseFinding = {
  repoFullName: 'acme/app',
  commitSha: 'abc123',
  severity: 'CRITICAL',
  category: 'Exposed secret',
  filePath: '.env',
  lineStart: 3,
  lineEnd: 3,
  problem: 'Possible API key committed to the repository',
  evidence: 'API_KEY=sk_live_...',
  fix: 'Remove the credential and rotate it.',
}

describe('buildRepoFindingFixTask', () => {
  it('always prefixes the branch name with fixflags/ so it can never collide with a default branch', () => {
    const task = buildRepoFindingFixTask(baseFinding)
    assert.match(task.branchName, /^fixflags\//)
  })

  it('produces a distinct branch per finding based on file and problem', () => {
    const a = buildRepoFindingFixTask(baseFinding)
    const b = buildRepoFindingFixTask({ ...baseFinding, filePath: 'src/other.env', problem: 'Different issue' })
    assert.notEqual(a.branchName, b.branchName)
  })

  it('includes the base commit, branch, and severity in the prompt', () => {
    const task = buildRepoFindingFixTask(baseFinding)
    assert.match(task.prompt, /Base commit: abc123/)
    assert.match(task.prompt, new RegExp(`Suggested branch: ${task.branchName}`))
    assert.match(task.prompt, /Severity: CRITICAL/)
  })

  it('adds a credential-rotation reminder for secret-related findings', () => {
    const task = buildRepoFindingFixTask(baseFinding)
    assert.ok(task.verification.some((step) => /rotate/i.test(step)))
  })

  it('does not add a rotation reminder for unrelated findings', () => {
    const task = buildRepoFindingFixTask({
      ...baseFinding,
      category: 'Dependency hygiene',
      problem: 'Outdated dependency',
    })
    assert.ok(!task.verification.some((step) => /rotate/i.test(step)))
  })

  it('handles an unknown commit sha gracefully', () => {
    const task = buildRepoFindingFixTask({ ...baseFinding, commitSha: null })
    assert.match(task.prompt, /Base commit: unknown/)
  })
})
