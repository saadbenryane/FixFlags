import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateRegistryMetadata, verifyCliRegistry } from './verify-cli-registry.mjs'

const SHA = 'a'.repeat(40)
const metadata = {
  'dist-tags': { candidate: '1.0.5', latest: '1.0.4' },
  versions: {
    '1.0.5': {
      version: '1.0.5',
      gitHead: SHA,
      dist: { tarball: 'https://registry.npmjs.org/fixflags/-/fixflags-1.0.5.tgz', integrity: 'sha512-proof' },
    },
  },
}

describe('CLI registry verification', () => {
  it('binds the candidate tag to the exact package version', () => {
    assert.equal(validateRegistryMetadata(metadata, '1.0.5', 'candidate', SHA).version, '1.0.5')
    assert.throws(() => validateRegistryMetadata(metadata, '1.0.5', 'latest'), /does not point/)
    assert.throws(() => validateRegistryMetadata(metadata, '1.0.5', 'candidate', 'b'.repeat(40)), /candidate Git SHA/)
  })

  it('returns registry evidence without a clean install when disabled', async () => {
    const evidence = await verifyCliRegistry({
      version: '1.0.5',
      requiredTag: 'candidate',
      expectedGitSha: SHA,
      fetchImpl: async () => ({ ok: true, json: async () => metadata }),
    })
    assert.equal(evidence.tag, 'candidate')
    assert.equal(evidence.installedVersion, null)
  })
})
