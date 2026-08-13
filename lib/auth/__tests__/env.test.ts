import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}))

import { logger } from '@/lib/logger'
import {
  getAuthBaseUrl,
  getPasskeyRpID,
  getPasskeyOrigin,
  isGoogleOAuthConfigured,
  isGithubOAuthConfigured,
  isAnyOAuthConfigured,
  oauthCallbackUrl,
  validateAuthEnv,
} from '@/lib/auth/env'

const mockedLoggerWarn = vi.mocked(logger.warn)

let originalEnv: NodeJS.ProcessEnv

function setEnv(name: string, value?: string): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

beforeEach(() => {
  originalEnv = { ...process.env }
  vi.clearAllMocks()
  // Clear relevant env vars
  delete process.env.BETTER_AUTH_URL
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.BETTER_AUTH_SECRET
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET
  delete process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_SECRET
  setEnv('NODE_ENV')
})

afterEach(() => {
  process.env = originalEnv
})

describe('getAuthBaseUrl', () => {
  it('returns BETTER_AUTH_URL when set', () => {
    process.env.BETTER_AUTH_URL = 'https://auth.example.com'
    expect(getAuthBaseUrl()).toBe('https://auth.example.com')
  })

  it('returns NEXT_PUBLIC_APP_URL when BETTER_AUTH_URL not set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    expect(getAuthBaseUrl()).toBe('https://app.example.com')
  })

  it('returns localhost default when neither is set', () => {
    expect(getAuthBaseUrl()).toBe('http://localhost:3000')
  })

  it('prefers BETTER_AUTH_URL over NEXT_PUBLIC_APP_URL', () => {
    process.env.BETTER_AUTH_URL = 'https://auth.example.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    expect(getAuthBaseUrl()).toBe('https://auth.example.com')
  })
})

describe('getPasskeyRpID', () => {
  it('returns hostname from BETTER_AUTH_URL', () => {
    process.env.BETTER_AUTH_URL = 'https://example.com'
    expect(getPasskeyRpID()).toBe('example.com')
  })

  it('returns hostname from NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    expect(getPasskeyRpID()).toBe('app.example.com')
  })

  it('returns localhost for default URL', () => {
    expect(getPasskeyRpID()).toBe('localhost')
  })

  it('handles URL with port', () => {
    process.env.BETTER_AUTH_URL = 'https://example.com:8080'
    expect(getPasskeyRpID()).toBe('example.com')
  })

  it('returns localhost on invalid URL', () => {
    process.env.BETTER_AUTH_URL = 'not-a-url'
    expect(getPasskeyRpID()).toBe('localhost')
  })
})

describe('getPasskeyOrigin', () => {
  it('returns base URL without trailing slash', () => {
    process.env.BETTER_AUTH_URL = 'https://example.com/'
    expect(getPasskeyOrigin()).toBe('https://example.com')
  })

  it('returns base URL when no trailing slash', () => {
    process.env.BETTER_AUTH_URL = 'https://example.com'
    expect(getPasskeyOrigin()).toBe('https://example.com')
  })

  it('returns default origin', () => {
    expect(getPasskeyOrigin()).toBe('http://localhost:3000')
  })
})

describe('isGoogleOAuthConfigured', () => {
  it('returns true when both client ID and secret are set', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    expect(isGoogleOAuthConfigured()).toBe(true)
  })

  it('returns false when client ID is missing', () => {
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    expect(isGoogleOAuthConfigured()).toBe(false)
  })

  it('returns false when client secret is missing', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'
    expect(isGoogleOAuthConfigured()).toBe(false)
  })

  it('returns false when both are missing', () => {
    expect(isGoogleOAuthConfigured()).toBe(false)
  })
})

describe('isGithubOAuthConfigured', () => {
  it('returns true when both client ID and secret are set', () => {
    process.env.GITHUB_CLIENT_ID = 'client-id'
    process.env.GITHUB_CLIENT_SECRET = 'client-secret'
    expect(isGithubOAuthConfigured()).toBe(true)
  })

  it('returns false when client ID is missing', () => {
    process.env.GITHUB_CLIENT_SECRET = 'client-secret'
    expect(isGithubOAuthConfigured()).toBe(false)
  })

  it('returns false when client secret is missing', () => {
    process.env.GITHUB_CLIENT_ID = 'client-id'
    expect(isGithubOAuthConfigured()).toBe(false)
  })

  it('returns false when both are missing', () => {
    expect(isGithubOAuthConfigured()).toBe(false)
  })
})

describe('isAnyOAuthConfigured', () => {
  it('returns true when Google OAuth is configured', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    expect(isAnyOAuthConfigured()).toBe(true)
  })

  it('returns true when GitHub OAuth is configured', () => {
    process.env.GITHUB_CLIENT_ID = 'client-id'
    process.env.GITHUB_CLIENT_SECRET = 'client-secret'
    expect(isAnyOAuthConfigured()).toBe(true)
  })

  it('returns true when both are configured', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    process.env.GITHUB_CLIENT_ID = 'client-id'
    process.env.GITHUB_CLIENT_SECRET = 'client-secret'
    expect(isAnyOAuthConfigured()).toBe(true)
  })

  it('returns false when neither is configured', () => {
    expect(isAnyOAuthConfigured()).toBe(false)
  })
})

describe('oauthCallbackUrl', () => {
  it('returns Google callback URL', () => {
    process.env.BETTER_AUTH_URL = 'https://example.com'
    expect(oauthCallbackUrl('google')).toBe('https://example.com/api/auth/callback/google')
  })

  it('returns GitHub callback URL', () => {
    process.env.BETTER_AUTH_URL = 'https://example.com'
    expect(oauthCallbackUrl('github')).toBe('https://example.com/api/auth/callback/github')
  })

  it('handles URL with trailing slash', () => {
    process.env.BETTER_AUTH_URL = 'https://example.com/'
    expect(oauthCallbackUrl('google')).toBe('https://example.com/api/auth/callback/google')
  })
})

describe('validateAuthEnv', () => {
  describe('in production', () => {
    beforeEach(() => {
      setEnv('NODE_ENV', 'production')
    })

    it('throws when BETTER_AUTH_SECRET is missing', () => {
      expect(() => validateAuthEnv()).toThrow('BETTER_AUTH_SECRET is required in production')
    })

    it('throws when BETTER_AUTH_SECRET is too short', () => {
      process.env.BETTER_AUTH_SECRET = 'short'
      expect(() => validateAuthEnv()).toThrow('BETTER_AUTH_SECRET must be at least 32 characters')
    })

    it('throws when BETTER_AUTH_SECRET is a weak placeholder', () => {
      const weakSecrets = [
        'generate-a-random-32-char-secret',
        'changeme',
        'secret',
        'better-auth-secret',
      ]
      for (const weakSecret of weakSecrets) {
        process.env.BETTER_AUTH_SECRET = weakSecret
        expect(() => validateAuthEnv()).toThrow('BETTER_AUTH_SECRET must be at least 32 characters and not a placeholder')
      }
    })

    it('throws when BETTER_AUTH_URL is missing', () => {
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
      expect(() => validateAuthEnv()).toThrow('BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL are required in production')
    })

    it('throws when NEXT_PUBLIC_APP_URL is missing', () => {
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
      process.env.BETTER_AUTH_URL = 'https://example.com'
      expect(() => validateAuthEnv()).toThrow('BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL are required in production')
    })

    it('throws when BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL do not match', () => {
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
      process.env.BETTER_AUTH_URL = 'https://example.com'
      process.env.NEXT_PUBLIC_APP_URL = 'https://other.com'
      expect(() => validateAuthEnv()).toThrow('BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL must match in production')
    })

    it('throws when BETTER_AUTH_URL is not HTTPS', () => {
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
      process.env.BETTER_AUTH_URL = 'http://example.com'
      process.env.NEXT_PUBLIC_APP_URL = 'http://example.com'
      expect(() => validateAuthEnv()).toThrow('BETTER_AUTH_URL must use https in production')
    })

    it('throws when OAuth providers are not configured', () => {
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
      process.env.BETTER_AUTH_URL = 'https://example.com'
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      expect(() => validateAuthEnv()).toThrow('Google and GitHub OAuth must be configured in production')
    })

    it('does not throw when all requirements are met', () => {
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
      process.env.BETTER_AUTH_URL = 'https://example.com'
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      process.env.GOOGLE_CLIENT_ID = 'id'
      process.env.GOOGLE_CLIENT_SECRET = 'secret'
      process.env.GITHUB_CLIENT_ID = 'id'
      process.env.GITHUB_CLIENT_SECRET = 'secret'
      expect(() => validateAuthEnv()).not.toThrow()
    })
  })

  describe('in development', () => {
    beforeEach(() => {
      setEnv('NODE_ENV', 'development')
    })

    it('warns when BETTER_AUTH_SECRET is weak', () => {
      process.env.BETTER_AUTH_SECRET = 'weak'
      validateAuthEnv()
      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        '[auth] BETTER_AUTH_SECRET is weak or a placeholder. Generate one with: openssl rand -hex 32'
      )
    })

    it('warns when BETTER_AUTH_SECRET is a placeholder', () => {
      process.env.BETTER_AUTH_SECRET = 'generate-a-random-32-char-secret'
      validateAuthEnv()
      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        '[auth] BETTER_AUTH_SECRET is weak or a placeholder. Generate one with: openssl rand -hex 32'
      )
    })

    it('does not warn when secret is strong', () => {
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
      validateAuthEnv()
      expect(mockedLoggerWarn).not.toHaveBeenCalled()
    })

    it('warns when Google client ID is set but secret missing', () => {
      process.env.GOOGLE_CLIENT_ID = 'id'
      validateAuthEnv()
      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        '[auth] GOOGLE_CLIENT_ID is set but GOOGLE_CLIENT_SECRET is missing - Google SSO disabled'
      )
    })

    it('warns when Google client secret is set but ID missing', () => {
      process.env.GOOGLE_CLIENT_SECRET = 'secret'
      validateAuthEnv()
      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        '[auth] GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is missing - Google SSO disabled'
      )
    })

    it('warns when GitHub client ID is set but secret missing', () => {
      process.env.GITHUB_CLIENT_ID = 'id'
      validateAuthEnv()
      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        '[auth] GITHUB_CLIENT_ID is set but GITHUB_CLIENT_SECRET is missing - GitHub SSO disabled'
      )
    })

    it('warns when GitHub client secret is set but ID missing', () => {
      process.env.GITHUB_CLIENT_SECRET = 'secret'
      validateAuthEnv()
      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        '[auth] GITHUB_CLIENT_SECRET is set but GITHUB_CLIENT_ID is missing - GitHub SSO disabled'
      )
    })

    it('does not warn when OAuth pairs are complete', () => {
      process.env.GOOGLE_CLIENT_ID = 'id'
      process.env.GOOGLE_CLIENT_SECRET = 'secret'
      process.env.GITHUB_CLIENT_ID = 'id'
      process.env.GITHUB_CLIENT_SECRET = 'secret'
      validateAuthEnv()
      expect(mockedLoggerWarn).not.toHaveBeenCalled()
    })
  })

  describe('weak secrets validation', () => {
    it('rejects known weak secrets in production', () => {
      setEnv('NODE_ENV', 'production')
      process.env.BETTER_AUTH_URL = 'https://example.com'
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      process.env.GOOGLE_CLIENT_ID = 'id'
      process.env.GOOGLE_CLIENT_SECRET = 'secret'
      process.env.GITHUB_CLIENT_ID = 'id'
      process.env.GITHUB_CLIENT_SECRET = 'secret'

      const weakSecrets = [
        'generate-a-random-32-char-secret',
        'changeme',
        'secret',
        'better-auth-secret',
      ]
      for (const weakSecret of weakSecrets) {
        process.env.BETTER_AUTH_SECRET = weakSecret
        expect(() => validateAuthEnv()).toThrow('BETTER_AUTH_SECRET must be at least 32 characters and not a placeholder')
      }
    })
  })
})
