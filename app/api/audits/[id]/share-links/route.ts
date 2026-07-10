import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canManageAudit } from '@/lib/audit/access'
import { canSharePublicly } from '@/lib/auth/entitlements'

function generateToken(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth.api
      .getSession({ headers: await headers() })
      .catch(() => null)

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!audit) return apiError('Audit not found', 404)
    if (!canManageAudit(audit, session?.user)) {
      return apiError('Sign in to manage share links for this audit', 401)
    }

    const links = await prisma.shareLink.findMany({
      where: { auditId: id },
      select: {
        id: true,
        token: true,
        label: true,
        expiresAt: true,
        maxViews: true,
        viewCount: true,
        lastViewedAt: true,
        revoked: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(links)
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth.api
      .getSession({ headers: await headers() })
      .catch(() => null)

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, isPublic: true },
    })
    if (!audit) return apiError('Audit not found', 404)
    if (!canManageAudit(audit, session?.user)) {
      return apiError('Sign in to create share links for this audit', 401)
    }
    if (audit.status !== 'COMPLETED') {
      return apiError('Only completed audits can be shared', 400)
    }

    const user = session?.user
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, plan: true, role: true, subscriptionStatus: true },
        })
      : null
    if (user && !canSharePublicly(user)) {
      return apiError('Share links require the Agency plan.', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      })
    }

    const body = await req.json().catch(() => ({}))
    const { label, expiresAt, maxViews, password } = body

    const link = await prisma.shareLink.create({
      data: {
        auditId: id,
        token: generateToken(),
        label: typeof label === 'string' ? label.slice(0, 100) : null,
        password: typeof password === 'string' && password.length > 0 ? password : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxViews: typeof maxViews === 'number' ? maxViews : null,
      },
      select: {
        id: true,
        token: true,
        label: true,
        expiresAt: true,
        maxViews: true,
        viewCount: true,
        lastViewedAt: true,
        revoked: true,
        createdAt: true,
      },
    })

    return NextResponse.json(link)
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const shareId = url.searchParams.get('shareId')
    if (!shareId) return apiError('shareId required', 400)

    const link = await prisma.shareLink.findUnique({
      where: { id: shareId },
      select: { id: true, audit: { select: { id: true, userId: true } } },
    })
    if (!link) return apiError('Share link not found', 404)

    const session = await auth.api
      .getSession({ headers: await headers() })
      .catch(() => null)
    if (!canManageAudit(link.audit, session?.user)) {
      return apiError('Sign in to manage share links for this share', 401)
    }

    await prisma.shareLink.update({
      where: { id: shareId },
      data: { revoked: true },
    })

    return NextResponse.json({ revoked: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
