import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPromotionReceipt, PROMOTED_CLI_VERSION } from './cli-promotion-receipt.mjs'

const SHA = 'a'.repeat(40)
const manifest = {
  version: PROMOTED_CLI_VERSION,
  gitHead: SHA,
  dist: {
    tarball: `https://registry.npmjs.org/fixflags/-/fixflags-${PROMOTED_CLI_VERSION}.tgz`,
    integrity: 'sha512-proof',
  },
}

function metadata(overrides = {}) {
  return {
    'dist-tags': { candidate: PROMOTED_CLI_VERSION, latest: PROMOTED_CLI_VERSION },
    versions: { [PROMOTED_CLI_VERSION]: manifest },
    ...overrides,
  }
}

describe('CLI promotion receipt', () => {
  it('binds candidate and latest to the exact immutable 1.0.5 package and candidate SHA', () => {
    const receipt = buildPromotionReceipt(metadata(), {
      version: PROMOTED_CLI_VERSION,
      gitSha: SHA,
      githubRunId: '42',
      githubRunAttempt: '1',
      githubWorkflowRef: 'saadbenryane/QewOS/.github/workflows/promote-latest.yml@refs/heads/main',
      promotedAt: '2026-08-25T00:00:00.000Z',
    })
    assert.equal(receipt.latestVersion, PROMOTED_CLI_VERSION)
    assert.equal(receipt.candidateVersion, PROMOTED_CLI_VERSION)
    assert.equal(receipt.gitSha, SHA)
    assert.equal(receipt.integrity, 'sha512-proof')
  })

  it('rejects a different latest tag, version, or abbreviated revision', () => {
    const context = { version: PROMOTED_CLI_VERSION, gitSha: SHA, githubRunId: '42', githubRunAttempt: '1' }
    assert.throws(
      () => buildPromotionReceipt(metadata({ 'dist-tags': { candidate: PROMOTED_CLI_VERSION, latest: '1.0.4' } }), context),
      /latest does not point/,
    )
    assert.throws(() => buildPromotionReceipt(metadata(), { ...context, version: '1.0.6' }), /locked/)
    assert.throws(() => buildPromotionReceipt(metadata(), { ...context, gitSha: 'abc123' }), /full candidate Git SHA/)
  })
})
