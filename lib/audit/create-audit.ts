import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { AuditStatus, Prisma } from '@prisma/client'
import {
  getEffectiveScanLimit,
  hasUnlimitedScans,
  isAdminUser,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { isAtCheckLimit } from '@/lib/audit/usage'
import { resolveIncludeAiForNewAudit } from '@/lib/audit/ai-report-entitlement'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { getPurchasedCreditsRemaining } from '@/lib/billing/credits'
import { assertPublicAuditUrl } from '@/lib/audit/url'
import type { AuditAttribution } from '@/lib/leads/attribution'

export interface CreateAuditOptions {
  url: string
  userId?: string | null
  parentId?: string
  skipUsageCount?: boolean
  auditMode?: 'SINGLE' | 'CRITICAL_PATH'
  monitoringMode?: 'FULL' | 'SUMMARY_ONLY'
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

export async function createAndEnqueueAudit(
  options: CreateAuditOptions
): Promise<CreateAuditResult> {
  const url = (await assertPublicAuditUrl(options.url)).toString()
  const attribution = options.attribution
  const includeAi = await resolveIncludeAiForNewAudit(options.userId ?? null)

  const data = {
    url,
    userId: options.userId ?? null,
    parentId: options.parentId ?? null,
    skipUsageCount: options.skipUsageCount ?? false,
    auditMode: options.auditMode ?? ('SINGLE' as const),
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
                const pendingAi = await tx.audit.count({
                  where: {
                    userId: user.id,
                    includeAi: true,
                    aiReviewAt: null,
                    status: { notIn: ['COMPLETED', 'FAILED'] },
                  },
                })
                const atAiCap = isAtCheckLimit(user.auditsUsed, pendingAi, limit)
                // A revoked subscription (payment failure, cancellation) is treated as
                // free-tier here too, matching resolveIncludeAiForNewAudit's "deny outright"
                // policy: no partial credit for a plan that's no longer actually paid for.
                // Falling through (same as an actual FREE user) means the audit still gets
                // created without a hard TOKEN_LIMIT error - it just won't include AI review.
                if (
                  atAiCap &&
                  user.plan !== 'FREE' &&
                  !hasRevokedSubscriptionStatus(user.subscriptionStatus)
                ) {
                  const purchased = await getPurchasedCreditsRemaining(user.id)
                  if (purchased <= 0) {
                    throw new AuditLimitError('TOKEN_LIMIT')
                  }
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
