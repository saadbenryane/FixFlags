import { logger } from '@/lib/logger'

const WEAK_AUTH_SECRETS = new Set([
  'generate-a-random-32-char-secret',
  'changeme',
  'secret',
  'better-auth-secret',
])

export function getAuthBaseUrl(): string {
  return process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

/** WebAuthn RP ID: hostname only (no port). `localhost` is valid for local dev. */
export function getPasskeyRpID(): string {
  try {
    return new URL(getAuthBaseUrl()).hostname || 'localhost'
  } catch {
    return 'localhost'
  }
}

/** WebAuthn origin: scheme + host (+ port), no trailing slash. */
export function getPasskeyOrigin(): string {
  return getAuthBaseUrl().replace(/\/$/, '')
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function isGithubOAuthConfigured(): boolean {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
}

export function isAnyOAuthConfigured(): boolean {
  return isGoogleOAuthConfigured() || isGithubOAuthConfigured()
}

export function oauthCallbackUrl(provider: 'google' | 'github'): string {
  const base = getAuthBaseUrl().replace(/\/$/, '')
  return `${base}/api/auth/callback/${provider}`
}

export function validateAuthEnv(): void {
  const secret = process.env.BETTER_AUTH_SECRET
  const authUrl = process.env.BETTER_AUTH_URL
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL

  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('BETTER_AUTH_SECRET is required in production')
    }
    if (secret.length < 32 || WEAK_AUTH_SECRETS.has(secret)) {
      throw new Error(
        'BETTER_AUTH_SECRET must be at least 32 characters and not a placeholder (use: openssl rand -hex 32)'
      )
    }
    if (!authUrl || !publicUrl) {
      throw new Error('BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL are required in production')
    }
    if (authUrl.replace(/\/$/, '') !== publicUrl.replace(/\/$/, '')) {
      throw new Error(
        'BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL must match in production (e.g. both https://fixflags.com)'
      )
    }
    if (!authUrl.startsWith('https://')) {
      throw new Error('BETTER_AUTH_URL must use https in production')
    }
    const missingOAuthProviders = [
      !isGoogleOAuthConfigured() ? 'Google' : null,
      !isGithubOAuthConfigured() ? 'GitHub' : null,
    ].filter((provider): provider is string => provider !== null)
    if (missingOAuthProviders.length > 0) {
      throw new Error(
        `${missingOAuthProviders.join(' and ')} OAuth must be configured in production`
      )
    }
  } else if (secret && (secret.length < 32 || WEAK_AUTH_SECRETS.has(secret))) {
    logger.warn(
      '[auth] BETTER_AUTH_SECRET is weak or a placeholder. Generate one with: openssl rand -hex 32'
    )
  }

  if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('[auth] GOOGLE_CLIENT_ID is set but GOOGLE_CLIENT_SECRET is missing - Google SSO disabled')
  }
  if (process.env.GOOGLE_CLIENT_SECRET && !process.env.GOOGLE_CLIENT_ID) {
    logger.warn('[auth] GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is missing - Google SSO disabled')
  }
  if (process.env.GITHUB_CLIENT_ID && !process.env.GITHUB_CLIENT_SECRET) {
    logger.warn('[auth] GITHUB_CLIENT_ID is set but GITHUB_CLIENT_SECRET is missing - GitHub SSO disabled')
  }
  if (process.env.GITHUB_CLIENT_SECRET && !process.env.GITHUB_CLIENT_ID) {
    logger.warn('[auth] GITHUB_CLIENT_SECRET is set but GITHUB_CLIENT_ID is missing - GitHub SSO disabled')
  }
}
