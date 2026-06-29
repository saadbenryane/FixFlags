import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAuthBaseUrl } from '@/lib/auth/env'

const GITHUB_REPO_SCOPE = 'repo'
const STATE_TTL_MS = 10 * 60 * 1000

export function isGithubRepoAccessConfigured(): boolean {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
}

export function githubRepoCallbackUrl(): string {
  return `${getAuthBaseUrl().replace(/\/$/, '')}/api/integrations/github/callback`
}

function stateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required to sign OAuth state')
  return secret
}

/** Signed, time-limited CSRF state - avoids a DB round trip for a short-lived OAuth handshake. */
export function signGithubConnectState(userId: string): string {
  const payload = `${userId}.${Date.now()}`
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyGithubConnectState(state: string, expectedUserId: string): boolean {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const [uid, ts, sig] = decoded.split('.')
    if (!uid || !ts || !sig) return false
    if (uid !== expectedUserId) return false
    const age = Date.now() - Number(ts)
    if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) return false

    const expected = createHmac('sha256', stateSecret()).update(`${uid}.${ts}`).digest('hex')
    const provided = Buffer.from(sig, 'hex')
    const wanted = Buffer.from(expected, 'hex')
    if (provided.length !== wanted.length) return false
    return timingSafeEqual(provided, wanted)
  } catch {
    return false
  }
}

export function buildGithubAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID ?? '',
    redirect_uri: githubRepoCallbackUrl(),
    scope: GITHUB_REPO_SCOPE,
    state,
    allow_signup: 'false',
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

interface GithubTokenResponse {
  access_token?: string
  scope?: string
  error?: string
  error_description?: string
}

export async function exchangeCodeForGithubToken(
  code: string
): Promise<{ accessToken: string; scope: string }> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: githubRepoCallbackUrl(),
    }),
  })
  if (!res.ok) throw new Error(`GitHub token exchange failed (${res.status})`)
  const data = (await res.json()) as GithubTokenResponse
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'GitHub returned no access token')
  }
  return { accessToken: data.access_token, scope: data.scope ?? '' }
}

export interface GithubUser {
  id: number
  login: string
}

export async function fetchGithubUser(accessToken: string): Promise<GithubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`Failed to fetch GitHub user (${res.status})`)
  return res.json()
}

export interface GithubRepo {
  id: number
  full_name: string
  private: boolean
  size: number
  default_branch: string
}

/** Repos the connected token can see - the user still picks a subset to allow-list for scanning. */
export async function listGithubRepos(accessToken: string): Promise<GithubRepo[]> {
  const repos: GithubRepo[] = []
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' } }
    )
    if (!res.ok) throw new Error(`Failed to list GitHub repos (${res.status})`)
    const batch = (await res.json()) as GithubRepo[]
    repos.push(...batch)
    if (batch.length < 100) break
  }
  return repos
}

export async function getGithubRepo(accessToken: string, fullName: string): Promise<GithubRepo> {
  const res = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`Failed to fetch repo ${fullName} (${res.status})`)
  return res.json()
}

/** Best-effort: revoke the grant on GitHub's side. We delete our local record regardless. */
export async function revokeGithubGrant(accessToken: string): Promise<void> {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) return
  await fetch(`https://api.github.com/applications/${clientId}/grant`, {
    method: 'DELETE',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ access_token: accessToken }),
  }).catch(() => {})
}
