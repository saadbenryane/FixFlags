import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { verifySharePassword } from '@/lib/security/share-password'
import { createShareGrant, SHARE_GRANT_COOKIE } from '@/lib/security/share-grant'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { canSharePublicly } from '@/lib/auth/entitlements'

async function authorize(token: string, password?: string) {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      auditId: true,
      revoked: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
      passwordHash: true,
      version: true,
      audit: {
        select: {
          status: true,
          user: { select: { id: true, role: true, plan: true, subscriptionStatus: true } },
        },
      },
    },
  })

  if (!link) return { error: apiError('Share link not found', 404, { code: 'SHARE_NOT_FOUND' }) }
  if (link.revoked) return { error: apiError('Share link revoked', 410, { code: 'SHARE_REVOKED' }) }
  if (!link.audit.user || !canSharePublicly(link.audit.user)) {
    return { error: apiError('This share link is no longer available', 403) }
  }
  if (link.audit.status !== 'COMPLETED') return { error: apiError('Report is not ready', 409) }
  if (link.expiresAt && link.expiresAt < new Date()) return { error: apiError('Share link expired', 410, { code: 'SHARE_EXPIRED' }) }
  if (link.maxViews !== null && link.viewCount >= link.maxViews) {
    return { error: apiError('Share link view limit reached', 410, { code: 'SHARE_EXHAUSTED' }) }
  }
  if (link.passwordHash && (!password || !(await verifySharePassword(link.passwordHash, password)))) {
    return { error: apiError('Incorrect password', 401, { code: 'SHARE_PASSWORD_INCORRECT' }) }
  }

  const claimed = await prisma.shareLink.updateMany({
    where: {
      id: link.id,
      revoked: false,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      ...(link.maxViews !== null ? { viewCount: { lt: link.maxViews } } : {}),
    },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  })
  if (claimed.count !== 1) return { error: apiError('Share link is no longer available', 410) }
  return { link }
}

async function respond(token: string, password?: string, requestUrl?: string) {
  const result = await authorize(token, password)
  if ('error' in result) return result.error
  const grant = createShareGrant({
    linkId: result.link.id,
    auditId: result.link.auditId,
    linkVersion: result.link.version,
    expiresAt: result.link.expiresAt,
  })
  const destination = `/share/${token}`
  const response = requestUrl
    ? NextResponse.redirect(new URL(destination, requestUrl))
    : NextResponse.json({ url: destination })
  response.cookies.set(SHARE_GRANT_COOKIE, grant.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: grant.expires,
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    return await respond(token, undefined, request.url)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    await enforceRateLimit({
      scope: `share-password:${token}`,
      identifier: requestClientId(request.headers),
      limit: 8,
      windowSeconds: 15 * 60,
    })
    const body = (await request.json().catch(() => ({}))) as { password?: unknown }
    return await respond(token, typeof body.password === 'string' ? body.password : undefined)
  } catch (error) {
    return handleRouteError(error)
  }
}
