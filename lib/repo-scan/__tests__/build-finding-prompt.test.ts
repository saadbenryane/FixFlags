import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { buildFindingPrompt } from '@/lib/repo-scan/build-finding-prompt'

describe('buildFindingPrompt', () => {
  it('builds a branch-scoped prompt for repo scan findings', () => {
    const prompt = buildFindingPrompt(
      'acme/app',
      {
        category: 'Security',
        severity: 'CRITICAL',
        filePath: 'src/config.ts',
        lineStart: 4,
        lineEnd: 6,
        problem: 'Hard-coded token is committed',
        evidence: 'src/config.ts includes API_TOKEN="sk_live_..."',
        fix: 'Move the token to an environment variable.',
      },
      'abc123'
    )

    assert.match(prompt, /^Fix this repository finding in acme\/app\./)
    assert.match(prompt, /Base commit: abc123/)
    assert.match(prompt, /File: src\/config\.ts:4-6/)
    assert.match(prompt, /Severity: CRITICAL/)
    assert.match(prompt, /Constraints:/)
    assert.match(prompt, /Do not rewrite unrelated code/)
    assert.match(prompt, /Verify:/)
    assert.doesNotMatch(prompt, /undefined/)
  })
})
