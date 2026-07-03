import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  buildRepoFindingPayload,
  repoFindingLocation,
} from '@/lib/mcp/repo-finding-payload'

describe('repo-finding-payload', () => {
  it('formats file locations with optional line ranges', () => {
    assert.equal(
      repoFindingLocation({ filePath: 'app/page.tsx', lineStart: 10, lineEnd: 12 }),
      'app/page.tsx:10-12'
    )
    assert.equal(
      repoFindingLocation({ filePath: 'app/page.tsx', lineStart: 10, lineEnd: 10 }),
      'app/page.tsx:10'
    )
    assert.equal(
      repoFindingLocation({ filePath: 'app/page.tsx', lineStart: null, lineEnd: null }),
      'app/page.tsx'
    )
  })

  it('builds a branch-ready fix task for MCP repo findings', () => {
    const payload = buildRepoFindingPayload({
      id: 'finding-1',
      repoFullName: 'acme/app',
      commitSha: 'abc123def456',
      severity: 'CRITICAL',
      category: 'Security',
      filePath: 'src/config.ts',
      lineStart: 7,
      lineEnd: 7,
      problem: 'Hard-coded API token is committed',
      evidence: 'src/config.ts:7 includes API_TOKEN="sk_live_..."',
      fix: 'Move the token to an environment variable and read it from process.env.',
    })

    assert.equal(payload.repoFullName, 'acme/app')
    assert.equal(payload.location, 'src/config.ts:7')
    assert.match(payload.branchName, /^fixflags\//)
    assert.match(payload.commitMessage, /Fix security finding/)
    assert.ok(payload.verification.some((step) => /Rotate/.test(step)))
    assert.match(payload.prompt, /Suggested branch:/)
    assert.match(payload.prompt, /Suggested commit:/)
    assert.match(payload.prompt, /Base commit: abc123def456/)
    assert.match(payload.prompt, /File: src\/config\.ts:7/)
    assert.match(payload.prompt, /Do not rewrite unrelated code/)
    assert.match(payload.prompt, /Tool target: generic/)
    assert.doesNotMatch(payload.prompt, /undefined/)
  })

  it('keeps non-secret findings scoped without rotation guidance', () => {
    const payload = buildRepoFindingPayload({
      id: 'finding-2',
      repoFullName: 'acme/app',
      commitSha: null,
      severity: 'IMPORTANT',
      category: 'Dependency hygiene',
      filePath: 'package.json',
      lineStart: null,
      lineEnd: null,
      problem: 'Package uses an unsupported dependency version',
      evidence: 'dependency version is below supported range',
      fix: 'Upgrade the dependency and run tests.',
    })

    assert.equal(payload.location, 'package.json')
    assert.ok(!payload.verification.some((step) => /Rotate/.test(step)))
    assert.match(payload.prompt, /Base commit: unknown/)
    assert.match(payload.prompt, /Tool target: generic/)
  })
})
