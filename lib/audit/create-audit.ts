import { productTransaction } from '@/lib/billing/product-transaction'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import { loadEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { prisma } from '@/lib/db'
import { dispatchAudit } from './dispatch'
import { buildExecutionSpec } from '@/lib/sites/application/execution-spec'
import type { ExecutionSpec } from '@/lib/sites/domain/execution-spec'
import type { SiteRecord } from '@/lib/sites/types'
import { AuditStatus, Prisma } from '@prisma/client'
import type { RecheckTrigger } from '@prisma/client'
import {
  hasUnlimitedScans,
  isAdminUser,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { resolveIncludeAiForNewAudit } from '@/lib/audit/ai-report-entitlement'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { wouldBlockNewCheckWithCredits } from '@/lib/billing/credits'
import { assertPublicNavigationUrl } from '@/lib/audit/url'
import type { AuditAttribution } from '@/lib/leads/attribution'
import type { UsageLimitAction, UsageLimitCode } from '@/lib/audit/check-limit'
import { PIPELINE_PROGRESS } from '@/lib/audit/progress'
import {
  encryptScanAccess,
  type ScanAccessConfig,
} from '@/lib/audit/scan-access'
import {
  checkAnonymousAuditAllowed,
  enforceAnonymousIpSoftCeiling,
  trackAnonymousAuditId,
} from '@/lib/audit/usage'
import { ensureProductProject } from '@/lib/audit/ensure-product-project'
import { canonicalProductHost } from '@/lib/audit/product-intelligence'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { ensureSiteForAudit } from '@/lib/sites/ensure-site'
import { admitScanAccess } from './scan-access-store'
import { resolveVisitorKey, rotateVisitorKey } from '@/lib/sites/visitor-identity'
import {
  refreshUserUsagePeriod,
  rollUserUsagePeriod,
} from '@/lib/billing/usage-period'
import { ProductLimitReached } from '@/lib/billing/product-capacity'
import { reviewDepthForPlan } from '@/lib/billing/plans'
import { OPEN_BETA_ACCESS } from '@/lib/billing/beta-policy'
import { PLAN_LIMIT_NOTICE } from '@/lib/marketing/copy/auth'
import { asReviewDepth, type ReviewDepth } from '@/lib/audit/review-depth'
import type { Plan } from '@prisma/client'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { assertAdminDomainActor, type AdminDomainActor } from '@/lib/admin/domain-actor'
import { assertScheduledClaim, staleScheduledClaim, type ScheduledRunClaim, type ScheduledClaimProject } from '@/lib/sites/application/scheduled-admission'

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
  /**
   * Client IP for the anonymous abuse ceiling and host rate limits. Abuse
   * control only: this value is never persisted as a tenancy key and never
   * identifies an anonymous Site board.
   */
  clientId?: string
  /**
   * Private anonymous visitor identity. Owns the provisional Site board and
   * scopes scan reuse, so one visitor can never be handed another's scan.
   * Falls back to a per-request visitor key when a caller omits it.
   */
  visitorKey?: string
  /** Preview/staging credentials for authenticated targets (signed-in only). */
  scanAccess?: ScanAccessConfig | null
  /** When true, inherit Project.scanAccessEncrypted if scanAccess is omitted. */
  useProjectScanAccess?: boolean
  /**
   * Binds a targeted Flag verification to exactly one Review. The attempt must
   * belong to the same owner, Project and parent Review. Duplicate requests
   * resume that Review; an unrelated in-flight manual Review is never reused.
   */
  verificationAttemptId?: string
  /** Targeted Outcome runs must own their Audit so their binding runs before finalization. */
  reuseActiveManual?: boolean
  /** Existing tenant-owned request attached atomically before the Audit job is enqueued. */
  runRequestId?: string
  runRequestAdmission?: Prisma.RunRequestUncheckedCreateInput
  scheduledClaim?: ScheduledRunClaim
  executionSpec?: ExecutionSpec
  operator?: AdminDomainActor
  /** Internal retry admission, authorized against this exact terminal Audit by its transport. */
  retryParent?: boolean
}

export interface CreateAuditResult {
  auditId: string
  status: AuditStatus
  /** True when an existing foreground/manual Review was resumed. */
  reused: boolean
  /** The parent persisted on the returned Review. Comparison code must use this value. */
  parentId: string | null
  /** Customer Site id (Project id or provisional p_…). */
  siteId: string
}

/** Internal control result for an identically admitted tenant command. */
export class RunAdmissionReplay extends Error {
  constructor(readonly runId: string, readonly auditId: string, readonly outcomeIds: string[] = []) { super('Run intent already admitted'); this.name = 'RunAdmissionReplay' }
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
  userId: string | null | undefined,
  retryParent = false,
): Promise<{ id: string; userId: string | null; projectId: string | null; status: AuditStatus; reviewDepth: number; isPublic: boolean }> {
  const parent = await prisma.audit.findUnique({
    where: { id: parentId },
    select: { id: true, userId: true, projectId: true, status: true, reviewDepth: true, isPublic: true },
  })

  if (!parent) {
    throw new ParentAuditError('Parent report not found', 404)
  }
  if (parent.status !== 'COMPLETED' && !(retryParent && parent.status === 'FAILED')) {
    throw new ParentAuditError('You can only continue from a completed report', 400)
  }
  if (!userId) {
    if (parent.userId !== null) {
      throw new ParentAuditError('Sign in to continue from an existing report', 401)
    }
    return parent
  }
  if (parent.userId !== userId) {
    throw new ParentAuditError('You can only continue from your own reports', 403)
  }
  return parent
}

async function resolveStoredReviewDepth(options: {
  isAnonTeaser: boolean
  parentId?: string
  userId?: string | null
}): Promise<ReviewDepth> {
  if (options.isAnonTeaser) return 1
  if (OPEN_BETA_ACCESS && options.userId) return 3
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
  const url = (await assertPublicNavigationUrl(options.url)).toString()
  const attribution = options.attribution
  const userId = options.userId ?? null

  // Anonymous teaser scans stay on one page and skip slow replay. The primary
  // page walk still runs. Parented re-checks and signed-in checks keep their
  // requested auditMode and slow replay. This choke point is shared by every
  // create path (checks, roast, MCP, watch).
  const isAnonTeaser = !userId && !options.parentId

  // Identity and abuse control are separate concerns. The visitor key owns the
  // board; the client IP only bounds abuse. Resolved here so every create path
  // (web, CLI, MCP) shares one definition of "who is this anonymous visitor".
  // A claim belongs to one account. It does not reserve the website. When this
  // browser's board for the host was already saved, start a new visitor so this
  // check gets its own board instead of the claimed one.
  let visitorKey = options.visitorKey ?? (isAnonTeaser ? await resolveVisitorKey() : '')

  const parentAudit = options.parentId ? await assertParentAuditAllowed(options.parentId, userId, options.retryParent) : null

  if (userId) {
    await refreshUserUsagePeriod(userId)
  }

  const includeAi = await resolveIncludeAiForNewAudit(userId)
  const reviewDepth = await resolveStoredReviewDepth({
    isAnonTeaser,
    parentId: options.parentId,
    userId,
  })

  let projectId: string | null = options.runRequestAdmission?.projectId ?? parentAudit?.projectId ?? null
  if (options.runRequestAdmission && parentAudit?.projectId && parentAudit.projectId !== projectId)
    throw new ParentAuditError('Choose a page on the same Site as the original check.', 400)
  if (userId && !projectId) {
    const existing = await prisma.project.findUnique({
      where: { userId_canonicalHost: { userId, canonicalHost: canonicalProductHost(url) } },
      select: { id: true },
    })
    projectId = existing?.id ?? null
  }

  const resolvedScanAccess = options.scanAccess ?? null
  if (resolvedScanAccess && !userId) throw new ParentAuditError('Sign in to use website access settings.', 401)

  const executionSpec = options.executionSpec ?? await buildExecutionSpec({
    projectId: projectId ?? '', targetUrl: url, environment: 'production', scope: 'SITE', outcomes: [],
  })
  if (executionSpec.targetUrl !== url) throw new ParentAuditError('Execution target does not match admission', 400)

  const data = {
    url,
    userId,
    // New evidence is private from admission. Explicit retries retain an
    // existing public report's visibility without publishing new first checks.
    isPublic: Boolean(options.retryParent && parentAudit?.isPublic === true &&
      !options.runRequestId && !options.runRequestAdmission && !resolvedScanAccess),
    projectId,
    scanAccessEncrypted: resolvedScanAccess ? encryptScanAccess(resolvedScanAccess) : null,
    parentId: options.parentId ?? null,
    recheckTrigger: options.recheckTrigger === 'WATCH' ? ('WATCH' as const) : options.parentId ? (options.recheckTrigger ?? 'MANUAL') : null,
    watchNotificationStatus:
      options.recheckTrigger === 'WATCH' ? ('PENDING' as const) : ('NOT_APPLICABLE' as const),
    skipUsageCount: options.skipUsageCount ?? false,
    // Capture pipeline only: SINGLE is teaser (reduced). CRITICAL_PATH is full
    // pasted-page capture. How far judgment goes is reviewDepth, not this enum.
    auditMode: isAnonTeaser
      ? ('SINGLE' as const)
      : (options.auditMode ?? ('CRITICAL_PATH' as const)),
    ...(options.parentId ? { monitoringMode: options.monitoringMode ?? ('FULL' as const) } : {}),
    status: 'QUEUED' as const,
    progress: PIPELINE_PROGRESS.QUEUED,
    executionSpec: { ...executionSpec, reviewDepth, scanAccess: { kind: resolvedScanAccess ? 'explicit' : 'public', origin: new URL(url).origin } } as Prisma.InputJsonValue,
    recoveryUntil: new Date(Date.now() + 60 * 60_000),
    dispatchState: 'PENDING' as const,
    dispatchNextAt: new Date(Date.now() + Math.max(0, options.delayMs ?? 0)),
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
    site: SiteRecord
  }
  async function packageAudit(tx: Prisma.TransactionClient, row: { id: string; status: AuditStatus; reused: boolean; parentId: string | null }) {
    if (options.runRequestAdmission) {
      if (!options.runRequestId || options.runRequestAdmission.id !== options.runRequestId || options.runRequestAdmission.projectId !== projectId)
        throw new ParentAuditError('Run admission does not match this Site', 400)
      if (row.reused) throw new ParentAuditError('This verification already has an execution. Inspect its recorded result.', 409)
    }
    const site = await ensureSiteForAudit({ allowRemovedForCleanup: Boolean(options.operator && executionSpec.scope === 'ACCOUNT_CHECKS' && executionSpec.accountChecks?.mode === 'cleanup'), url, auditId: row.id, userId, projectId, sessionKey: visitorKey || null }, tx)
    if (!site.siteId?.trim()) throw new Error('Site board identity was empty after admission')
    return { ...row, site }
  }
  const isWatchReview = options.recheckTrigger === 'WATCH'
  if (userId) {
    audit = await productTransaction(async (tx) => {
      const cleanup = Boolean(options.operator && executionSpec.scope === 'ACCOUNT_CHECKS' && executionSpec.accountChecks?.mode === 'cleanup')
      const policy = await loadEffectiveEntitlements(userId,tx)
      if(!policy || !policy.available && !cleanup) throw new ParentAuditError('This account cannot start new work.',403)
      if (options.scheduledClaim && !options.runRequestAdmission) throw staleScheduledClaim()
      if (options.runRequestAdmission) {
        // An existing Site command retains its selected identity. Only new-URL
        // admission may create or restore a Site through hostname resolution.
        const [ownedProject] = await tx.$queryRaw<Array<ScheduledClaimProject & { id: string; canonicalHost: string | null }>>`
          SELECT "id", "url", "canonicalHost", "watchInterval", "watchEveryMinutes",
            "watchNextRunAt", "watchLastAttemptAt", "watchLeaseUntil" FROM "projects"
          WHERE "id" = ${options.runRequestAdmission.projectId} AND "userId" = ${userId}
            AND (${cleanup} OR "deletedAt" IS NULL)
          FOR UPDATE
        `
        if (options.scheduledClaim) {
          if (!ownedProject || !isWatchReview || options.runRequestAdmission.source !== 'WATCH' ||
            !['SITE', 'OUTCOMES'].includes(executionSpec.scope) || !policy.watchIntervals.includes(options.scheduledClaim.interval))
            throw staleScheduledClaim()
          assertScheduledClaim(ownedProject, options.scheduledClaim)
        }
        if (!ownedProject) throw new ParentAuditError('Site not found', 404)
        if (!cleanup && canonicalProductHost(url) !== (ownedProject.canonicalHost ?? canonicalProductHost(ownedProject.url)))
          throw new ParentAuditError('Choose a page on the same Site as the original check.', 400)
        projectId = ownedProject.id
        if (!cleanup) await ensureDefaultMonitoring(tx, projectId, userId)
      } else if (!cleanup) {
        try {
          const ownedProject = await ensureProductProject(userId, url, tx)
          if (options.parentId && projectId && projectId !== ownedProject.id) {
            throw new ParentAuditError('Choose a page on the same Site as the original check.', 400)
          }
          projectId = ownedProject.id
        } catch (error) {
          if (error instanceof ProductLimitReached) throw new AuditLimitError('UPGRADE_REQUIRED', {
            action: 'upgrade', message: PLAN_LIMIT_NOTICE.copy['site-limit'].body,
          })
          throw error
        }
      }
      if(cleanup && !options.runRequestAdmission && (!projectId || !(await tx.project.findFirst({where:{id:projectId,userId},select:{id:true}})))) throw new ParentAuditError('Cleanup Site not found.',404)
      const user = await rollUserUsagePeriod(tx, userId)
      if (!user) throw new Error('User not found')
      if (options.operator && projectId) await assertAdminDomainActor(options.operator, userId, projectId, tx)
      if (user.lifecycleStatus !== 'ACTIVE' && !(options.operator && executionSpec.scope === 'ACCOUNT_CHECKS' && executionSpec.accountChecks?.mode === 'cleanup'))
        throw new ParentAuditError('This account cannot start new work.', 403)

      if (options.verificationAttemptId) {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`fixflags:verification-audit:${options.verificationAttemptId}`}, 0)
          )
        `
        const attempt = await tx.improvementAttempt.findFirst({
          where: {
            id: options.verificationAttemptId,
            sourceAuditId: options.parentId,
            improvement: {
              projectId: projectId ?? undefined,
              project: { userId },
            },
          },
          select: {
            id: true,
            verificationAudit: {
              select: { id: true, status: true, parentId: true },
            },
          },
        })
        if (!attempt) throw new ParentAuditError('Verification attempt not found', 404)
        if (attempt.verificationAudit && attempt.verificationAudit.status !== 'FAILED') {
          return packageAudit(tx, { ...attempt.verificationAudit, reused: true })
        }
        if (attempt.verificationAudit?.status === 'FAILED') {
          await tx.improvementAttempt.update({
            where: { id: attempt.id },
            data: { verificationAuditId: null },
          })
        }
      }

      if (projectId && !isWatchReview) {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`fixflags:manual-review:${projectId}`}, 0)
          )
        `
      }

      if (options.runRequestAdmission) {
        const intent = options.runRequestAdmission
        const existing = await tx.runRequest.findUnique({ where: { projectId_source_idempotencyKey: {
          projectId: intent.projectId, source: intent.source!, idempotencyKey: intent.idempotencyKey,
        } }, select: { id: true, auditId: true, requestHash: true, requestedByUserId: true, selections: { select: { outcomeId: true } } } })
        if (existing) {
          if (existing.requestHash !== intent.requestHash || existing.requestedByUserId !== (options.operator?.actorId ?? userId))
            throw new ParentAuditError('Run idempotency key belongs to another Site run', 409)
          if (!existing.auditId) throw new ParentAuditError('The previous run has no admitted execution.', 409)
          throw new RunAdmissionReplay(existing.id, existing.auditId, existing.selections.map(item => item.outcomeId).sort())
        }
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
        if (options.verificationAttemptId || options.reuseActiveManual === false) {
          throw new ParentAuditError(
            'Another Site check is still running. Try Verify again when it finishes.',
            409,
          )
        }
        return packageAudit(tx, { ...activeManualReview, reused: true })
      }

      if (
        !options.skipUsageCount &&
        !hasUnlimitedScans(user) &&
        !isAdminUser(user)
      ) {
        const limit = policy.scanLimit ?? -1
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

          const gate = await wouldBlockNewCheckWithCredits({ ...gateUser, plan: policy.plan, auditsLimit: policy.scanLimit ?? -1 }, pending)
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

      const access = await admitScanAccess(tx, { projectId, userId, targetUrl: url,
        explicit: options.scanAccess, useProject: options.useProjectScanAccess, allowRemovedForCleanup: cleanup })
      data.scanAccessEncrypted = access.config ? encryptScanAccess(access.config) : null
      data.executionSpec = { ...executionSpec, reviewDepth, scanAccess: access.intent } as Prisma.InputJsonValue
      if (access.config) data.isPublic = false
      const created = await tx.audit.create({
        data: { ...data, projectId, planAtAdmission: user.plan, journeyReviewIncluded: true },
        select: { id: true, parentId: true },
      })
      if (options.runRequestAdmission) {
        if (options.runRequestAdmission.projectId !== projectId || options.runRequestAdmission.requestedByUserId !== (options.operator?.actorId ?? userId))
          throw new ParentAuditError('Run admission does not match this Site owner', 400)
        if (executionSpec.fixtureSetup) {
          const setup = executionSpec.fixtureSetup
          const admitted = await tx.outcomeFixture.updateMany({ where: { id: setup.id, projectId: projectId!,
            version: setup.version, enabled: true }, data: { authorizedAt: null, lastDryRunVersion: null,
            lastDryRunAt: null, lastDryRunResult: Prisma.DbNull } })
          if (admitted.count !== 1) throw new ParentAuditError('Signup configuration changed before admission. Run it again.', 409)
        }
        await tx.runRequest.create({ data: { ...options.runRequestAdmission, auditId: created.id,
          executionSpec: data.executionSpec } })
      }
      if (options.runRequestId && !options.runRequestAdmission) {
        const attached = await tx.runRequest.updateMany({
          where: {
            id: options.runRequestId,
            projectId: projectId ?? undefined,
            requestedByUserId: userId,
            auditId: null,
          },
          data: { auditId: created.id },
        })
        if (attached.count !== 1) {
          throw new ParentAuditError('Outcome run request not found', 404)
        }
      }
      if (options.verificationAttemptId) {
        await tx.improvementAttempt.update({
          where: { id: options.verificationAttemptId },
          data: { verificationAuditId: created.id },
        })
      }
      return packageAudit(tx, {
        id: created.id, status: 'QUEUED' as const, reused: false, parentId: created.parentId,
      })
    })
  } else {
    audit = await executionTransaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`fixflags:anon-url-reuse:${visitorKey}:${url}`}, 0)
        )
      `
      const windowStart = new Date(Date.now() - ANON_URL_REUSE_WINDOW_MS)
      // Reuse must be scoped to what THIS visitor already owns. Matching on the
      // URL alone handed a stranger's scan to a first-time visitor, who then had
      // no claim cookie for it and so signed up to an empty account.
      //
      // The visitor's own board for this host is the only reuse candidate: it is
      // keyed by (sessionKey, canonicalHost) and already records the audit that
      // produced it, so "my last scan of this site" needs no new state.
      const canonicalHost = canonicalProductHost(url)
      const ownedSite = await tx.provisionalSite.findUnique({
        where: {
          sessionKey_canonicalHost: { sessionKey: visitorKey, canonicalHost },
        },
        select: { primaryAuditId: true, claimedProjectId: true },
      })
      // Someone already saved this browser's board for the website. Leave that
      // claim on the account and continue as a new visitor with a new board.
      if (ownedSite?.claimedProjectId) {
        visitorKey = await rotateVisitorKey()
      }
      const ownedAuditId = ownedSite?.claimedProjectId ? null : ownedSite?.primaryAuditId
      if (ownedAuditId && (!options.retryParent || ownedAuditId !== options.parentId)) {
        const owned = await tx.audit.findFirst({
          where: {
            id: ownedAuditId,
            userId: null,
            ...(options.retryParent ? { parentId: options.parentId } : {}),
            AND: [
              { status: { not: 'FAILED' } },
              {
                OR: [
                  { status: { notIn: ['COMPLETED', 'FAILED'] }, createdAt: { gte: windowStart } },
                  { status: 'COMPLETED', completedAt: { gte: windowStart } },
                ],
              },
            ],
          },
          select: { id: true, status: true, parentId: true },
        })
        if (owned) {
          return packageAudit(tx, { ...owned, reused: true })
        }
      }

      const anonCheck = options.retryParent && options.skipUsageCount ? { allowed: true, code: undefined, action: undefined, error: undefined } : await checkAnonymousAuditAllowed()
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
      return packageAudit(tx, {
        id: created.id, status: 'QUEUED' as const, reused: false, parentId: created.parentId,
      })
    })
  }

  const site = audit.site

  if (!userId && (!options.parentId || options.retryParent)) {
    // Claimed before the reuse return: reuse is now scoped to this visitor's
    // own board, so the audit is always theirs to claim. Without this, a
    // returning visitor signed up to an account that did not contain their Site.
    await trackAnonymousAuditId(audit.id)
  }

  if (audit.reused) {
    return {
      auditId: audit.id,
      status: audit.status,
      reused: true,
      parentId: audit.parentId,
      siteId: site.siteId,
    }
  }

  await dispatchAudit(audit.id)

  await recordSiteLifecycleEvent({
    name: 'analyze_started',
    idempotencyKey: `analyze_started:${audit.id}`,
    userId: userId ?? null,
    projectId: projectId ?? null,
    properties: {
      anonymous: !userId,
      trigger: options.recheckTrigger ?? 'manual',
      journeyId: options.attribution?.journeyId,
    },
  }).catch(() => undefined)

  return {
    auditId: audit.id,
    status: audit.status,
    reused: false,
    parentId: audit.parentId,
    siteId: site.siteId,
  }
}
