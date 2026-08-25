import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const publish = readFileSync('.github/workflows/publish-cli.yml', 'utf8')
const promote = readFileSync('.github/workflows/promote-latest.yml', 'utf8')
const cliPackage = JSON.parse(readFileSync('fixflags-cli/package.json', 'utf8'))

describe('release workflow contract', () => {
  it('publishes stable CLI builds to candidate, never directly to latest', () => {
    assert.match(publish, /npm publish --tag candidate --access public/)
    assert.doesNotMatch(publish, /npm publish --tag latest/)
    assert.match(publish, /--tag candidate --clean-install/)
    assert.match(publish, /RELEASE_EXPECTED_GIT_SHA: \$\{\{ github\.sha \}\}/)
    assert.equal(cliPackage.version, '1.0.5')
    assert.equal(cliPackage.publishConfig.tag, 'candidate')
  })

  it('promotes an exact candidate SHA and uploads a durable receipt', () => {
    assert.match(promote, /candidate_sha:/)
    assert.match(promote, /ref: \$\{\{ github\.event\.inputs\.candidate_sha \}\}/)
    assert.match(promote, /--tag candidate --clean-install/)
    assert.match(promote, /npm dist-tag add fixflags@\$\{\{ github\.event\.inputs\.version \}\} latest/)
    assert.match(promote, /scripts\/cli-promotion-receipt\.mjs/)
    assert.match(promote, /actions\/upload-artifact@v4/)
  })

  it('has one canonical latest-promotion workflow', () => {
    assert.equal(existsSync('.github/workflows/update-latest-dist-tag.yml'), false)
  })
})
