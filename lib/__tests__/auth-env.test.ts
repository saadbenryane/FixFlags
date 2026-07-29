import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'vitest'
import {
  getAuthBaseUrl,
  getPasskeyOrigin,
  getPasskeyRpID,
  isGoogleOAuthConfigured,
  oauthCallbackUrl,
  validateAuthEnv,
} from '../auth/env'

const ORIGINAL_ENV = { ...process.env }

describe('lib/auth/env', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('getAuthBaseUrl prefers BETTER_AUTH_URL', () => {
    process.env.BETTER_AUTH_URL = 'https://fixflags.com'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    assert.equal(getAuthBaseUrl(), 'https://fixflags.com')
  })

  it('getPasskeyRpID uses hostname only', () => {
    process.env.BETTER_AUTH_URL = 'https://fixflags.com'
    assert.equal(getPasskeyRpID(), 'fixflags.com')
    process.env.BETTER_AUTH_URL = 'http://localhost:3000'
    assert.equal(getPasskeyRpID(), 'localhost')
  })

  it('getPasskeyOrigin strips trailing slash', () => {
    process.env.BETTER_AUTH_URL = 'https://fixflags.com/'
    assert.equal(getPasskeyOrigin(), 'https://fixflags.com')
  })

  it('oauthCallbackUrl builds provider callback path', () => {
    process.env.BETTER_AUTH_URL = 'https://fixflags.com'
    assert.equal(oauthCallbackUrl('google'), 'https://fixflags.com/api/auth/callback/google')
    assert.equal(oauthCallbackUrl('github'), 'https://fixflags.com/api/auth/callback/github')
  })

  it('isGoogleOAuthConfigured requires both id and secret', () => {
    process.env.GOOGLE_CLIENT_ID = 'id'
    process.env.GOOGLE_CLIENT_SECRET = 'secret'
    assert.equal(isGoogleOAuthConfigured(), true)
    delete process.env.GOOGLE_CLIENT_SECRET
    assert.equal(isGoogleOAuthConfigured(), false)
  })

  it('validateAuthEnv rejects weak production secret', () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production' }
    process.env.BETTER_AUTH_SECRET = 'generate-a-random-32-char-secret'
    process.env.BETTER_AUTH_URL = 'https://fixflags.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://fixflags.com'
    assert.throws(() => validateAuthEnv(), /BETTER_AUTH_SECRET/)
  })

  it('validateAuthEnv rejects mismatched URLs in production', () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production' }
    process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
    process.env.BETTER_AUTH_URL = 'https://fixflags.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.fixflags.com'
    assert.throws(() => validateAuthEnv(), /must match/)
  })

  it('validateAuthEnv requires Google and GitHub OAuth in production', () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'https://fixflags.com',
      NEXT_PUBLIC_APP_URL: 'https://fixflags.com',
    }
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.GITHUB_CLIENT_ID
    delete process.env.GITHUB_CLIENT_SECRET

    assert.throws(() => validateAuthEnv(), /Google and GitHub OAuth/)

    process.env.GOOGLE_CLIENT_ID = 'google-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret'
    assert.throws(() => validateAuthEnv(), /GitHub OAuth/)

    process.env.GITHUB_CLIENT_ID = 'github-id'
    process.env.GITHUB_CLIENT_SECRET = 'github-secret'
    assert.doesNotThrow(() => validateAuthEnv())
  })
})
