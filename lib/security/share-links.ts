import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import { canManageAudit } from '@/lib/audit/access'
import { canSharePublicly } from '@/lib/auth/entitlements'
import { hashSharePassword } from '@/lib/security/share-password'

type SessionUser = { id: string } | null | undefined

export type CreateShareLinkInput = {
  label?: string | null
  password?: string | null
  expiresAt?: Date | null
  maxViews?: number | null
}

export class ShareLinkServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly action?: string
  ) {
    super(message)
    this.name = 'ShareLinkServiceError'
  }
}

const shareLinkSelect = {
  id: true,
  token: true,
  label: true,
  expiresAt: true,
  maxViews: true,
  viewCount: true,
  lastViewedAt: true,
  revoked: true,
  createdAt: true,
} as const

function generateShareToken(): string {
  return randomBytes(32).toString('base64url')
}

async function requireManagedAudit(auditId: string, sessionUser: SessionUser) {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { id: true, userId: true, status: true },
  })
  if (!audit) throw new ShareLinkServiceError('Report not found', 404)
  if (!canManageAudit(audit, sessionUser)) {
    throw new ShareLinkServiceError('Sign in to manage share links for this report', 401)
  }
  return audit
}

export async function listManagedShareLinks(auditId: string, sessionUser: SessionUser) {
  await requireManagedAudit(auditId, sessionUser)
  return prisma.shareLink.findMany({
    where: { auditId },
    select: shareLinkSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createManagedShareLink(
  auditId: string,
  sessionUser: SessionUser,
  input: CreateShareLinkInput
) {
  const audit = await requireManagedAudit(auditId, sessionUser)
  if (audit.status !== 'COMPLETED') {
    throw new ShareLinkServiceError('Only completed reports can be shared', 400)
  }

  const user = sessionUser
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { id: true, plan: true, role: true, subscriptionStatus: true },
      })
    : null
  if (!user || !canSharePublicly(user)) {
    throw new ShareLinkServiceError(
      'Share links require the Studio plan.',
      402,
      'UPGRADE_REQUIRED',
      'upgrade'
    )
  }

  return prisma.shareLink.create({
    data: {
      auditId,
      token: generateShareToken(),
      label: input.label ?? null,
      passwordHash: input.password ? await hashSharePassword(input.password) : null,
      expiresAt: input.expiresAt ?? null,
      maxViews: input.maxViews ?? null,
    },
    select: shareLinkSelect,
  })
}

export async function revokeManagedShareLink(shareId: string, sessionUser: SessionUser) {
  const link = await prisma.shareLink.findUnique({
    where: { id: shareId },
    select: { id: true, audit: { select: { id: true, userId: true } } },
  })
  if (!link) throw new ShareLinkServiceError('Share link not found', 404)
  if (!canManageAudit(link.audit, sessionUser)) {
    throw new ShareLinkServiceError('Sign in to manage share links for this share', 401)
  }

  await prisma.shareLink.update({
    where: { id: shareId },
    data: { revoked: true },
  })
  return { revoked: true as const }
}
