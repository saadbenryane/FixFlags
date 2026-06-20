import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import {
  getAuthBaseUrl,
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
})
