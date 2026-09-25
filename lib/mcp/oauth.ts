import { createHash, randomBytes } from 'node:crypto'
import { SITE_URL } from '@/lib/marketing/copy/brand'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { generateApiKey, hashApiKey } from '@/lib/security/api-keys'

export const MCP_SCOPES = ['sites:read', 'sites:run'] as const
const CODE_TTL_MS = 5 * 60 * 1000
const ACCESS_TTL_MS = 60 * 60 * 1000
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function mcpIssuer(): string {
  return SITE_URL.replace(/\/$/, '')
}

export function mcpResource(): string {
  return `${mcpIssuer()}/api/mcp`
}

export function protectedResourceMetadataUrl(): string {
  return `${mcpIssuer()}/.well-known/oauth-protected-resource/api/mcp`
}

export function canonicalResource(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.hash) return null
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const protocol = url.protocol.toLowerCase()
    const hostname = url.hostname.toLowerCase()
    const port = url.port ? `:${url.port}` : ''
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname
    return `${protocol}//${hostname}${port}${pathname}`
  } catch {
    return null
  }
}

export function audienceMatches(audience: string, resource: string): boolean {
  const left = canonicalResource(audience)
  const right = canonicalResource(resource)
  return Boolean(left && right && left === right)
}

export function credentialAllows(
  credential: { audience: string | null; scopes: string[] },
  scope: string,
): boolean {
  if (!credential.audience) return true
  if (credential.scopes.includes(scope)) return true
  return scope === 'sites:read' && credential.scopes.includes('sites:run')
}

export function requiredToolScope(tool: string | null): 'sites:read' | 'sites:run' | null {
  if (!tool) return null
  if (tool === 'ff_run' || tool === 'ff_verify_outcome' || tool === 'ff_verify_flag') return 'sites:run'
  return 'sites:read'
}

export function wwwAuthenticate(input: {
  error?: 'invalid_token' | 'invalid_request' | 'insufficient_scope'
  scope?: string
  description?: string
} = {}): string {
  const parts = [
    'Bearer realm="FixFlags"',
    `resource_metadata="${protectedResourceMetadataUrl()}"`,
  ]
  if (input.error) parts.push(`error="${input.error}"`)
  if (input.scope) parts.push(`scope="${input.scope}"`)
  if (input.description) parts.push(`error_description="${input.description.replaceAll('"', '')}"`)
  return parts.join(', ')
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  if (verifier.length < 43 || verifier.length > 128) return false
  if (!/^[-A-Za-z0-9._~]+$/.test(verifier)) return false
  return pkceChallenge(verifier) === challenge
}

export function normalizeScopes(value: string | null | undefined): string[] {
  const allowed = new Set<string>(MCP_SCOPES)
  const scopes = [...new Set((value ?? '').split(/\s+/).filter((scope) => allowed.has(scope)))]
  return scopes.length > 0 ? scopes : ['sites:read']
}

export function isAllowedRedirect(uri: string): boolean {
  try {
    const url = new URL(uri)
    if (url.username || url.password || url.hash) return false
    if (url.protocol === 'https:') return true
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

export function protectedResourceDocument() {
  return {
    resource: mcpResource(),
    authorization_servers: [mcpIssuer()],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ['header'],
  }
}

export function authorizationServerDocument() {
  const issuer = mcpIssuer()
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...MCP_SCOPES],
    authorization_response_iss_parameter_supported: true,
  }
}

export async function redirectAllowedForClient(clientId: string, redirectUri: string): Promise<boolean> {
  if (!isAllowedRedirect(redirectUri)) return false
  if (clientId.startsWith('https://')) {
    const safe = normalizeAuditUrl(clientId)
    if (!safe.ok) return false
    const response = await fetch(safe.url, {
      signal: AbortSignal.timeout(5_000),
      redirect: 'error',
      headers: { accept: 'application/json' },
    }).catch(() => null)
    if (!response?.ok) return false
    const body = await response.json().catch(() => null) as { client_id?: string; redirect_uris?: unknown } | null
    return body?.client_id === clientId && Array.isArray(body.redirect_uris) && body.redirect_uris.includes(redirectUri)
  }
  const client = await prisma.oAuthClient.findUnique({ where: { id: clientId }, select: { redirectUris: true } })
  return Boolean(client?.redirectUris.includes(redirectUri))
}

export async function issueAuthorizationCode(input: {
  userId: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  resource: string
  scopes: string[]
}): Promise<string> {
  const code = randomBytes(32).toString('base64url')
  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash: hashApiKey(code),
      userId: input.userId,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      resource: input.resource,
      scopes: input.scopes,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  })
  return code
}

async function issueTokenPair(userId: string, resource: string, scopes: string[]) {
  const access = generateApiKey()
  await prisma.apiKey.create({
    data: {
      userId,
      name: 'MCP access',
      keyHash: access.keyHash,
      prefix: access.prefix,
      lastFour: access.lastFour,
      scopes,
      audience: resource,
      expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
    },
  })
  const refresh = randomBytes(32).toString('base64url')
  await prisma.oAuthRefreshToken.create({
    data: {
      tokenHash: hashApiKey(refresh),
      userId,
      audience: resource,
      scopes,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  })
  return {
    access_token: access.rawKey,
    token_type: 'Bearer' as const,
    expires_in: ACCESS_TTL_MS / 1000,
    refresh_token: refresh,
    scope: scopes.join(' '),
  }
}

export async function exchangeAuthorizationCode(input: {
  code: string
  redirectUri: string
  clientId: string
  codeVerifier: string
  resource: string
}) {
  if (!audienceMatches(input.resource, mcpResource())) return null
  const row = await prisma.oAuthAuthorizationCode.findUnique({ where: { codeHash: hashApiKey(input.code) } })
  if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now()) return null
  if (row.clientId !== input.clientId || row.redirectUri !== input.redirectUri) return null
  if (!audienceMatches(row.resource, input.resource) || !pkceMatches(input.codeVerifier, row.codeChallenge)) return null
  const consumed = await prisma.oAuthAuthorizationCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  if (consumed.count !== 1) return null
  return issueTokenPair(row.userId, row.resource, row.scopes)
}

export async function exchangeRefreshToken(input: { refreshToken: string; resource: string }) {
  if (!audienceMatches(input.resource, mcpResource())) return null
  const row = await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash: hashApiKey(input.refreshToken) } })
  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null
  if (!audienceMatches(row.audience, input.resource)) return null
  const revoked = await prisma.oAuthRefreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (revoked.count !== 1) return null
  return issueTokenPair(row.userId, row.audience, row.scopes)
}

export async function revokeCredential(token: string): Promise<void> {
  const tokenHash = hashApiKey(token)
  await prisma.apiKey.updateMany({
    where: { keyHash: tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  await prisma.oAuthRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
