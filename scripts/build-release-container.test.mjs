import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { releaseContainerBuildArguments } from './build-release-container.mjs'

const sha = 'a'.repeat(40)
const settings = {
  NEXT_PUBLIC_APP_URL: 'https://validation.example.com',
  BETTER_AUTH_URL: 'https://validation.example.com',
  NEXT_PUBLIC_GA_ID: 'G-EXAMPLE123',
  RESEND_API_KEY: 'private-provider-key',
  BETTER_AUTH_SECRET: 'private-auth-secret',
}
describe('release image configuration', () => {
  it('builds the designated public origin and exact revision without secrets', () => {
    const args = releaseContainerBuildArguments(settings, sha)
    assert.ok(args.includes(`GIT_COMMIT_SHA=${sha}`))
    assert.ok(args.includes(`NEXT_PUBLIC_APP_URL=${settings.NEXT_PUBLIC_APP_URL}`))
    assert.ok(args.includes(`NEXT_PUBLIC_GA_ID=${settings.NEXT_PUBLIC_GA_ID}`))
    assert.ok(!args.join(' ').includes('private-'))
  })
  it('rejects a verification runtime paired with a production build', () => {
    assert.throws(() => releaseContainerBuildArguments({ ...settings, BETTER_AUTH_URL: 'https://fixflags.com' }, sha))
  })
  it('rejects app URLs containing credentials or paths', () => {
    for (const url of ['https://user:password@example.com', 'https://example.com/path', 'https://example.com/?secret=value', 'https://example.com/#settings', 'file:///app'])
      assert.throws(() => releaseContainerBuildArguments({ ...settings, NEXT_PUBLIC_APP_URL: url, BETTER_AUTH_URL: url }, sha))
    assert.throws(() => releaseContainerBuildArguments({ ...settings, BETTER_AUTH_URL: 'https://user:password@validation.example.com' }, sha))
  })
  it('rejects missing or abbreviated source revisions', () => {
    for (const value of [undefined, '', sha.slice(0, 7)])
      assert.throws(() => releaseContainerBuildArguments(settings, value))
  })
  it('permits an environment without analytics and rejects invalid IDs', () => {
    assert.ok(releaseContainerBuildArguments({ ...settings, NEXT_PUBLIC_GA_ID: '' }, sha).includes('NEXT_PUBLIC_GA_ID='))
    assert.throws(() => releaseContainerBuildArguments({ ...settings, NEXT_PUBLIC_GA_ID: 'private-secret' }, sha))
  })
})
