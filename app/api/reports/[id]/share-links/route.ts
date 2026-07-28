import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canManageAudit } from '@/lib/audit/access'
import { canSharePublicly } from '@/lib/auth/entitlements'
import { hashSharePassword } from '@/lib/security/share-password'

function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

const createShareLinkSchema = z.object({
  label: z.string().trim().min(1).max(100).nullable().optional(),
  password: z.string().min(10).max(200).nullable().optional(),
  expiresAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), 'Expiry must be in the future').nullable().optional(),
  maxViews: z.number().int().min(1).max(1_000_000).nullable().optional(),
})

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
    if (!audit) return apiError('Report not found', 404)
    if (!canManageAudit(audit, session?.user)) {
      return apiError('Sign in to manage share links for this report', 401)
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
    if (!audit) return apiError('Report not found', 404)
    if (!canManageAudit(audit, session?.user)) {
      return apiError('Sign in to create share links for this report', 401)
    }
    if (audit.status !== 'COMPLETED') {
      return apiError('Only completed reports can be shared', 400)
    }

    const user = session?.user
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, plan: true, role: true, subscriptionStatus: true },
        })
      : null
    if (!user || !canSharePublicly(user)) {
      return apiError('Share links require the Studio plan.', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      })
    }

    const parsed = createShareLinkSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid share link settings', 400, {
        code: 'INVALID_SHARE_LINK',
      })
    }
    const { label, expiresAt, maxViews, password } = parsed.data

    const link = await prisma.shareLink.create({
      data: {
        auditId: id,
        token: generateToken(),
        label: label ?? null,
        passwordHash: password ? await hashSharePassword(password) : null,
        expiresAt: expiresAt ?? null,
        maxViews: maxViews ?? null,
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
