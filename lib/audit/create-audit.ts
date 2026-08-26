import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { AuditStatus, Prisma } from '@prisma/client'
import type { RecheckTrigger } from '@prisma/client'
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
import type { UsageLimitAction, UsageLimitCode } from '@/lib/audit/check-limit'
import { PIPELINE_PROGRESS } from '@/lib/audit/progress'
import {
  encryptScanAccess,
  decryptScanAccess,
  type ScanAccessConfig,
} from '@/lib/audit/scan-access'
import {
  checkAnonymousAuditAllowed,
  enforceAnonymousIpSoftCeiling,
  trackAnonymousAuditId,
} from '@/lib/audit/usage'
import { ensureProductProject } from '@/lib/audit/ensure-product-project'
import {
  refreshUserUsagePeriod,
  rollUserUsagePeriod,
} from '@/lib/billing/usage-period'
import { ProductLimitReached } from '@/lib/billing/product-capacity'
import { reviewDepthForPlan } from '@/lib/billing/plans'
import { asReviewDepth, type ReviewDepth } from '@/lib/audit/review-depth'
import type { Plan } from '@prisma/client'

export interface CreateAuditOptions {
  url: string
  userId?: string | null
  parentId?: string
  recheckTrigger?: RecheckTrigger
  skipUsageCount?: boolean
  auditMode?: 'SINGLE' | 'CRITICAL_PATH'
  /** Always FULL. Legacy SUMMARY_ONLY enum value remains in Prisma but is never written. */
  monitoringMode?: 'FULL'
  delayMs?: number
  attribution?: AuditAttribution
  /** Client IP / fingerprint for anon soft IP ceiling. Required for anonymous creates in prod. */
  clientId?: string
  /** Preview/staging credentials for authenticated targets (signed-in only). */
  scanAccess?: ScanAccessConfig | null
  /** When true, inherit Project.scanAccessEncrypted if scanAccess is omitted. */
  useProjectScanAccess?: boolean
}

export interface CreateAuditResult {
  auditId: string
  status: AuditStatus
  /** True when an existing foreground/manual Review was resumed. */
  reused: boolean
  /** The parent persisted on the returned Review. Comparison code must use this value. */
  parentId: string | null
}

/** Unsigned visitors reuse a public scan of the same URL instead of starting a duplicate job. */
export const ANON_URL_REUSE_WINDOW_MS = 60 * 60 * 1000

export class AuditLimitError extends Error {
  readonly code: UsageLimitCode
  readonly action: UsageLimitAction
  readonly renewalAt?: Date

  constructor(
    code: UsageLimitCode,
    options?: { action?: UsageLimitAction; message?: string; renewalAt?: Date }
  ) {
    const action =
      options?.action ??
      (code === 'AUTH_REQUIRED'
        ? 'signup'
        : code === 'UPGRADE_REQUIRED'
          ? 'upgrade'
          : 'buy_credits')
    const message =
      options?.message ??
      (code === 'AUTH_REQUIRED'
        ? 'You’ve used your free scan. Create a free account for fix prompts and more checks.'
        : code === 'UPGRADE_REQUIRED'
          ? 'New URL check limit reached. Upgrade to continue.'
          : 'New URL check limit reached. Buy credits or upgrade your plan to continue.')
    super(message)
    this.name = 'AuditLimitError'
    this.code = code
    this.action = action
    this.renewalAt = options?.renewalAt
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
  const parent = await prisma.audit.findUnique({
    where: { id: parentId },
    select: { id: true, userId: true, status: true, reviewDepth: true },
  })

  if (!parent) {
    throw new ParentAuditError('Parent report not found', 404)
  }
  if (parent.status !== 'COMPLETED') {
    throw new ParentAuditError('You can only continue from a completed report', 400)
  }
  if (!userId) {
    if (parent.userId !== null) {
      throw new ParentAuditError('Sign in to continue from an existing report', 401)
    }
    return
  }
  if (parent.userId !== userId) {
    throw new ParentAuditError('You can only continue from your own reports', 403)
  }
}

async function resolveStoredReviewDepth(options: {
  isAnonTeaser: boolean
  parentId?: string
  userId?: string | null
}): Promise<ReviewDepth> {
  if (options.isAnonTeaser) return 1
  if (options.parentId) {
    const parent = await prisma.audit.findUnique({
      where: { id: options.parentId },
      select: { reviewDepth: true },
    })
    return asReviewDepth(parent?.reviewDepth)
  }
  if (!options.userId) return 1
  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    select: { plan: true },
  })
  return reviewDepthForPlan((user?.plan ?? 'FREE') as Plan)
}

export async function createAndEnqueueAudit(
  options: CreateAuditOptions
): Promise<CreateAuditResult> {
  const url = (await assertPublicAuditUrl(options.url)).toString()
  const attribution = options.attribution
  const userId = options.userId ?? null

  // Anonymous teaser scans run the reduced pipeline (single page, no critical
  // path discovery, no flow walk, no slow replay) so first value lands in
  // ~60-90s. Parented re-checks and signed-in checks always keep the full
  // pipeline and their requested auditMode. Mirrors the anon gate below: this
  // choke point is shared by every create path (checks, roast, MCP, watch).
  const isAnonTeaser = !userId && !options.parentId

  if (options.parentId) {
    await assertParentAuditAllowed(options.parentId, userId)
  }

  if (userId) {
    await refreshUserUsagePeriod(userId)
  }

  const includeAi = await resolveIncludeAiForNewAudit(userId)
  const reviewDepth = await resolveStoredReviewDepth({
    isAnonTeaser,
    parentId: options.parentId,
    userId,
  })

  let projectId: string | null = null
  let inheritedScanAccessEncrypted: string | null = null
  if (userId) {
    if (options.parentId) {
      const parent = await prisma.audit.findUnique({
        where: { id: options.parentId },
        select: { projectId: true, scanAccessEncrypted: true },
      })
      projectId = parent?.projectId ?? null
      inheritedScanAccessEncrypted = parent?.scanAccessEncrypted ?? null
    }
    if (!projectId) {
      try {
        const project = await ensureProductProject(userId, url)
        projectId = project.id
      } catch (error) {
        if (error instanceof ProductLimitReached) {
          throw new AuditLimitError('UPGRADE_REQUIRED', {
            action: 'upgrade',
            message: `Your plan supports ${error.limit} ${error.limit === 1 ? 'Product' : 'Products'}. Choose an existing Product or see the paid plans.`,
          })
        }
        throw error
      }
    }
    if (!inheritedScanAccessEncrypted && projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { scanAccessEncrypted: true },
      })
      inheritedScanAccessEncrypted = project?.scanAccessEncrypted ?? null
    }
  }

  const resolvedScanAccess =
    options.scanAccess ??
    (options.useProjectScanAccess !== false && inheritedScanAccessEncrypted
      ? decryptScanAccess(inheritedScanAccessEncrypted)
      : null)

  const data = {
    url,
    userId,
    isPublic: true,
    projectId,
    scanAccessEncrypted: resolvedScanAccess ? encryptScanAccess(resolvedScanAccess) : null,
    parentId: options.parentId ?? null,
    recheckTrigger: options.parentId ? (options.recheckTrigger ?? 'MANUAL') : null,
    watchNotificationStatus:
      options.recheckTrigger === 'WATCH' ? ('PENDING' as const) : ('NOT_APPLICABLE' as const),
    skipUsageCount: options.skipUsageCount ?? false,
    auditMode: isAnonTeaser
      ? ('SINGLE' as const)
      : (options.auditMode ?? ('CRITICAL_PATH' as const)),
    ...(options.parentId ? { monitoringMode: options.monitoringMode ?? ('FULL' as const) } : {}),
    status: 'QUEUED' as const,
    progress: PIPELINE_PROGRESS.QUEUED,
    includeAi,
    reviewDepth,
    journeyReviewIncluded: false,
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

  let audit: {
    id: string
    status: AuditStatus
    reused: boolean
    parentId: string | null
  }
  const isWatchReview = options.recheckTrigger === 'WATCH'
  if (userId) {
    let conflicts = 0
    while (true) {
      try {
        audit = await prisma.$transaction(
          async (tx) => {
            const user = await rollUserUsagePeriod(tx, userId)
            if (!user) throw new Error('User not found')

            if (projectId && !isWatchReview) {
              await tx.$executeRaw`
                SELECT pg_advisory_xact_lock(
                  hashtextextended(${`fixflags:manual-review:${projectId}`}, 0)
                )
              `
            }

            // A Product has one foreground/manual Review at a time. This lives
            // in the serializable creation boundary so repeated clicks and
            // concurrent transports resume the same Review without spending a
            // second credit or enqueueing duplicate work. Watch runs use their
            // own lease and are intentionally excluded.
            const activeManualReview = projectId && !isWatchReview
              ? await tx.audit.findFirst({
                  where: {
                    projectId,
                    status: { notIn: ['COMPLETED', 'FAILED'] },
                    OR: [{ recheckTrigger: null }, { recheckTrigger: 'MANUAL' }],
                  },
                  orderBy: { createdAt: 'desc' },
                  select: { id: true, status: true, parentId: true },
                })
              : null
            if (activeManualReview) {
              return { ...activeManualReview, reused: true }
            }

            if (
              !options.skipUsageCount &&
              !hasUnlimitedScans(user) &&
              !isAdminUser(user)
            ) {
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
                    gate.code === 'TOKEN_LIMIT' ? 'TOKEN_LIMIT' : 'UPGRADE_REQUIRED',
                    {
                      action:
                        gate.action === 'buy_credits' || gate.action === 'upgrade'
                          ? gate.action
                          : undefined,
                      message: gate.error,
                      renewalAt: user.usagePeriodEnd,
                    }
                  )
                }
              }
            }

            const created = await tx.audit.create({
              data: { ...data, journeyReviewIncluded: true },
              select: { id: true, parentId: true },
            })
            return {
              id: created.id,
              status: 'QUEUED' as const,
              reused: false,
              parentId: created.parentId,
            }
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
    audit = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`fixflags:anon-url-reuse:${url}`}, 0)
        )
      `
      const windowStart = new Date(Date.now() - ANON_URL_REUSE_WINDOW_MS)
      const recent = await tx.audit.findFirst({
        where: {
          url,
          isPublic: true,
          AND: [
            { status: { not: 'FAILED' } },
            {
              OR: [
                {
                  status: { notIn: ['COMPLETED', 'FAILED'] },
                  createdAt: { gte: windowStart },
                },
                {
                  status: 'COMPLETED',
                  completedAt: { gte: windowStart },
                },
              ],
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, parentId: true },
      })
      if (recent) {
        return { ...recent, reused: true }
      }

      const anonCheck = await checkAnonymousAuditAllowed()
      if (!anonCheck.allowed) {
        throw new AuditLimitError(anonCheck.code ?? 'AUTH_REQUIRED', {
          action: anonCheck.action ?? 'signup',
          message: anonCheck.error,
        })
      }
      if (options.clientId) {
        await enforceAnonymousIpSoftCeiling(options.clientId)
      }

      const created = await tx.audit.create({
        data,
        select: { id: true, parentId: true },
      })
      return {
        id: created.id,
        status: 'QUEUED' as const,
        reused: false,
        parentId: created.parentId,
      }
    })
  }

  if (audit.reused) {
    return {
      auditId: audit.id,
      status: audit.status,
      reused: true,
      parentId: audit.parentId,
    }
  }

  if (!userId && !options.parentId) {
    await trackAnonymousAuditId(audit.id)
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

  return {
    auditId: audit.id,
    status: audit.status,
    reused: false,
    parentId: audit.parentId,
  }
}
