import { integrationRelease } from '@/lib/integrations/release-policy'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SiteConnectionProvider } from '@prisma/client'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { prisma } from '@/lib/db'
import { requireSiteAccess } from '@/lib/sites/request-access'
import {
  accessTokenForConnection,
  buildGoogleAuthorizeUrl,
  googleConnectionConfigured,
  googleConnectionCredentialScope,
  liveGoogleClient,
  signConnectionState,
  syncGoogleConnection,
} from '@/lib/sites/connections/google'
import { decryptSecret } from '@/lib/security/crypto'
import { SITE_CONNECTION_COPY as C } from '@/lib/marketing/copy/site-connections'
import { GoogleProviderError } from '@/lib/integrations/google-response'

const bodySchema = z.object({
  provider: z.enum(['SEARCH_CONSOLE', 'ANALYTICS']),
  action: z.enum(['connect', 'sync']).default('connect'),
})

async function owner(siteId: string) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) return { error: apiError('Sign in to manage Site connections.', 401) }
  const access = await requireSiteAccess(siteId)
  if (!access.ok) return { error: apiError(access.message, access.status) }
  if (access.decision.role !== 'owner' || !access.decision.site.projectId) {
    return { error: apiError('Claim this Site before connecting a provider.', 403) }
  }
  if (access.decision.site.userId !== session.user.id) {
    return { error: apiError('Site not found', 404) }
  }
  return {
    userId: session.user.id,
    projectId: access.decision.site.projectId,
    host: access.decision.site.canonicalHost,
    siteUrl: access.decision.site.url,
  }
}

export async function POST(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const owned = await owner(siteId)
    if ('error' in owned) return owned.error
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Choose Search Console or Analytics.', 400)
    if (integrationRelease(parsed.data.provider === 'SEARCH_CONSOLE' ? 'search-console' : 'analytics') !== 'available')
      return apiError(C.comingSoonBody, 409, { code: 'INTEGRATION_COMING_SOON' })
    if (!googleConnectionConfigured()) {
      return apiError('Google sign-in is not configured on this FixFlags server yet.', 503)
    }
    const provider = parsed.data.provider as SiteConnectionProvider
    if (parsed.data.action === 'connect') {
      const state = signConnectionState({ userId: owned.userId, projectId: owned.projectId, provider })
      return NextResponse.json({ authorizeUrl: buildGoogleAuthorizeUrl(state, provider) })
    }
    const connection = await prisma.siteConnection.findUnique({
      where: { projectId_provider: { projectId: owned.projectId, provider } },
    })
    if (!connection || connection.authorizedByUserId !== owned.userId || connection.status === 'REVOKED') return apiError('Connect this provider first.', 409)
    let token: string | null
    try { token = await accessTokenForConnection(connection, owned.userId) }
    catch (error) {
      if (error instanceof GoogleProviderError && error.requiresReauthentication) token = null
      else {
        const response = apiError(C.retainedUnavailable, 503, {
          code: error instanceof GoogleProviderError ? error.code : 'PROVIDER_UNAVAILABLE', action: 'retry' })
        if (error instanceof GoogleProviderError && error.retryAfterMs)
          response.headers.set('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)))
        return response
      }
    }
    if (!token) {
      const changed = await prisma.siteConnection.updateMany({
        where: googleConnectionCredentialScope(connection, owned.userId),
        data: { status: 'NEEDS_REAUTH', statusDetail: 'Reconnect this Google account to keep reading it.' },
      })
      if (changed.count !== 1) return apiError(C.changed, 409)
      return apiError('Reconnect this Google account.', 401)
    }
    const synced = await syncGoogleConnection({
      connectionId: connection.id,
      projectId: owned.projectId,
      userId: owned.userId,
      provider,
      host: owned.host,
      siteUrl: owned.siteUrl,
      accessToken: token,
      propertyId: connection.propertyId,
    })
    return NextResponse.json({ status: synced.status.toLowerCase(), detail: synced.detail })
  } catch (error) {
    return handleRouteError(error, 'Could not update this connection')
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const owned = await owner(siteId)
    if ('error' in owned) return owned.error
    const parsed = bodySchema.pick({ provider: true }).safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Choose Search Console or Analytics.', 400)
    const connection = await prisma.siteConnection.findUnique({
      where: { projectId_provider: { projectId: owned.projectId, provider: parsed.data.provider } },
    })
    if (!connection || connection.authorizedByUserId !== owned.userId || connection.status === 'REVOKED') return NextResponse.json({ ok: true })
    const disconnected = await prisma.siteConnection.updateMany({
      where: googleConnectionCredentialScope(connection, owned.userId),
      data: {
        status: 'REVOKED',
        statusDetail: 'Disconnected. Earlier numbers stay labeled with the date they were read.',
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
      },
    })
    if (disconnected.count !== 1) return apiError(C.changed, 409)
    const token = connection.encryptedRefreshToken ?? connection.encryptedAccessToken
    if (token) await liveGoogleClient().revoke(decryptSecret(token)).catch(() => undefined)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not disconnect this provider')
  }
}
