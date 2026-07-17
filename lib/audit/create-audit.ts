import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { AuditStatus, Prisma } from '@prisma/client'
import {
  getEffectiveScanLimit,
  hasUnlimitedScans,
  isAdminUser,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { resolveIncludeAiForNewAudit } from '@/lib/audit/ai-report-entitlement'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { wouldBlockNewCheckWithCredits } from '@/lib/billing/credits'
import { assertPublicAuditUrl } from '@/lib/audit/url'
import type { AuditAttribution } from '@/lib/leads/attribution'

export interface CreateAuditOptions {
  url: string
  userId?: string | null
  parentId?: string
  skipUsageCount?: boolean
  auditMode?: 'SINGLE' | 'CRITICAL_PATH'
  /** Always FULL. Legacy SUMMARY_ONLY enum value remains in Prisma but is never written. */
  monitoringMode?: 'FULL'
  delayMs?: number
  attribution?: AuditAttribution
}

export interface CreateAuditResult {
  auditId: string
  status: AuditStatus
}

export class AuditLimitError extends Error {
  readonly code: 'UPGRADE_REQUIRED' | 'TOKEN_LIMIT'

  constructor(code: 'UPGRADE_REQUIRED' | 'TOKEN_LIMIT') {
    super(
      code === 'UPGRADE_REQUIRED'
        ? 'Audit limit reached. Upgrade to continue.'
        : 'Audit limit reached. Upgrade your plan to continue.'
    )
    this.name = 'AuditLimitError'
    this.code = code
  }
}

export class ParentAuditError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ParentAuditError'
    this.status = status
  }
}

async function assertParentAuditAllowed(
  parentId: string,
  userId: string | null | undefined
): Promise<void> {
  if (!userId) {
    throw new ParentAuditError('Sign in to continue from an existing report', 401)
  }

  const parent = await prisma.audit.findUnique({
    where: { id: parentId },
    select: { id: true, userId: true, status: true },
  })

  if (!parent) {
    throw new ParentAuditError('Parent report not found', 404)
  }
  if (parent.userId !== userId) {
    throw new ParentAuditError('You can only continue from your own reports', 403)
  }
  if (parent.status !== 'COMPLETED') {
    throw new ParentAuditError('You can only continue from a completed report', 400)
  }
}

export async function createAndEnqueueAudit(
  options: CreateAuditOptions
): Promise<CreateAuditResult> {
  const url = (await assertPublicAuditUrl(options.url)).toString()
  const attribution = options.attribution

  if (options.parentId) {
    await assertParentAuditAllowed(options.parentId, options.userId)
  }

  const includeAi = await resolveIncludeAiForNewAudit(options.userId ?? null)

  const data = {
    url,
    userId: options.userId ?? null,
    parentId: options.parentId ?? null,
    skipUsageCount: options.skipUsageCount ?? false,
    auditMode: options.auditMode ?? ('CRITICAL_PATH' as const),
    monitoringMode: options.monitoringMode ?? ('FULL' as const),
    status: 'QUEUED' as const,
    progress: 5,
    includeAi,
    ...(attribution
      ? {
          normalizedDomain: attribution.normalizedDomain,
          source: attribution.source,
          referrer: attribution.referrer,
          utmSource: attribution.utmSource,
          utmMedium: attribution.utmMedium,
          utmCampaign: attribution.utmCampaign,
          gclid: attribution.gclid,
          fbclid: attribution.fbclid,
        }
      : {}),
  }

  let audit: { id: string }
  if (options.userId && !options.skipUsageCount) {
    let conflicts = 0
    while (true) {
      try {
        audit = await prisma.$transaction(
          async (tx) => {
            const user = await tx.user.findUnique({ where: { id: options.userId! } })
            if (!user) throw new Error('User not found')

            if (!hasUnlimitedScans(user) && !isAdminUser(user)) {
              const limit = getEffectiveScanLimit(user)
              if (!isUnlimitedScanLimit(limit)) {
                const pending = await tx.audit.count({
                  where: {
                    userId: user.id,
                    skipUsageCount: false,
                    status: { notIn: ['COMPLETED', 'FAILED'] },
                  },
                })

                // Revoked paid subscriptions are treated as FREE for hard gates.
                const gateUser =
                  user.plan !== 'FREE' && hasRevokedSubscriptionStatus(user.subscriptionStatus)
                    ? { ...user, plan: 'FREE' as const }
                    : user

                const gate = await wouldBlockNewCheckWithCredits(gateUser, pending)
                if (!gate.allowed) {
                  throw new AuditLimitError(
                    gate.code === 'TOKEN_LIMIT' ? 'TOKEN_LIMIT' : 'UPGRADE_REQUIRED'
                  )
                }
              }
            }

            return tx.audit.create({ data, select: { id: true } })
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        )
        break
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          conflicts < 2
        ) {
          conflicts++
          continue
        }
        throw error
      }
    }
  } else {
    audit = await prisma.audit.create({ data, select: { id: true } })
  }

  try {
    await getAuditQueue().add(
      'audit',
      { auditId: audit.id },
      {
        jobId: audit.id,
        attempts: 1,
        delay: options.delayMs ?? 0,
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    )
  } catch (error) {
    await prisma.audit.update({
      where: { id: audit.id },
      data: {
        status: 'FAILED',
        errorMsg: 'Failed to enqueue audit job',
        failureCode: 'QUEUE_ENQUEUE_FAILED',
        failureStage: 'queue',
      },
    })
    throw error
  }

  return { auditId: audit.id, status: 'QUEUED' }
}
