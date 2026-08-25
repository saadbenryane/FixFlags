import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { attestReleaseEnvironment, validateRunningRevision } from './release-revision-attestation.mjs'

const SHA = 'a'.repeat(40)

describe('release environment revision attestation', () => {
  it('requires the exact full candidate SHA', () => {
    assert.equal(validateRunningRevision({ ok: true, commit: SHA }, SHA), SHA)
    assert.throws(() => validateRunningRevision({ ok: true, commit: SHA.slice(0, 8) }, SHA), /full Git SHA/)
    assert.throws(() => validateRunningRevision({ ok: true, commit: 'b'.repeat(40) }, SHA), /expected/)
  })

  it('refuses the production origin before probing', async () => {
    await assert.rejects(
      attestReleaseEnvironment(
        { RELEASE_ENV_URL: 'https://fixflags.com', RELEASE_EXPECTED_GIT_SHA: SHA },
        async () => { throw new Error('must not fetch') },
      ),
      /cannot target production/,
    )
  })

  it('returns revision-bound evidence for a release environment', async () => {
    const evidence = await attestReleaseEnvironment(
      { RELEASE_ENV_URL: 'https://release.fixflags.test', RELEASE_EXPECTED_GIT_SHA: SHA },
      async () => ({ ok: true, json: async () => ({ ok: true, commit: SHA }) }),
    )
    assert.equal(evidence.targetOrigin, 'https://release.fixflags.test')
    assert.equal(evidence.runningCommit, SHA)
  })
})
