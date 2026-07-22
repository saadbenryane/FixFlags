import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { verifySharePassword } from '@/lib/security/share-password'

async function resolveLink(token: string) {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      auditId: true,
      revoked: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
      password: true,
      audit: { select: { id: true, userId: true, isPublic: true } },
    },
  })

  if (!link || link.revoked) return { error: 'not_found' as const }
  if (link.expiresAt && link.expiresAt < new Date()) return { error: 'expired' as const }
  if (link.maxViews && link.viewCount >= link.maxViews) return { error: 'max_views' as const }

  return { link }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const resolved = await resolveLink(token)

    if ('error' in resolved) {
      return apiError(resolved.error as string, 404)
    }

    const { link } = resolved

    if (link.password) {
      return apiError('Share link requires password', 401)
    }

    if (!link.audit.isPublic) {
      await prisma.audit.update({
        where: { id: link.auditId },
        data: { isPublic: true },
      })
    }

    await prisma.shareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })

    return NextResponse.json({ auditId: link.auditId, url: `/report/${link.auditId}` })
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { password } = await req.json().catch(() => ({}))

    if (!password || typeof password !== 'string') {
      return apiError('Password required', 401)
    }

    const resolved = await resolveLink(token)
    if ('error' in resolved) {
      return apiError(resolved.error as string, 404)
    }

    const { link } = resolved

    if (!verifySharePassword(link.password, password)) {
      return apiError('Incorrect password', 401)
    }

    if (!link.audit.isPublic) {
      await prisma.audit.update({
        where: { id: link.auditId },
        data: { isPublic: true },
      })
    }

    await prisma.shareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })

    return NextResponse.json({ auditId: link.auditId, url: `/report/${link.auditId}` })
  } catch (err) {
    return handleRouteError(err)
  }
}
