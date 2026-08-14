import type {
  AuditStatus,
  ImprovementStatus,
  ProjectWatchInterval,
  ReportCompleteness,
  VerificationOutcome,
  WatchNotificationStatus,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  parseProductIntelligence,
  type VerifiedLearning,
} from '@/lib/audit/product-intelligence'
import {
  synthesizeProductSignals,
  type SynthesizedSignalContext,
} from '@/lib/signals/judgment'

const ACTIVE_IMPROVEMENT_STATUSES: ImprovementStatus[] = [
  'PROPOSED',
  'ACCEPTED',
  'IN_PROGRESS',
  'READY_TO_VERIFY',
  'UNVERIFIED',
]

export type ProductReviewSummaryDTO = {
  id: string
  status: AuditStatus
  score: number | null
  reportCompleteness: ReportCompleteness
  unresolvedCount: number
  createdAt: string
  completedAt: string | null
  failureMessage: string | null
  isUpdateReview: boolean
}

export type ProductAttentionItemDTO = {
  id: string
  title: string
  judgment: string
  recommendedChange: string
  successCondition: string
  priority: number
  status: ImprovementStatus
  evidence: string | null
  rubric: string | null
  severity: string | null
  sourceReviewId: string | null
  sourceFlagId: string | null
  latestAttempt: ProductAttemptDTO | null
}

export type ProductAttemptDTO = {
  id: string
  sourceReviewId: string
  sourceFlagId: string | null
  builder: string
  changeSummary: string | null
  deploymentReference: string | null
  verificationReviewId: string | null
  outcome: VerificationOutcome | null
  testedCondition: string | null
  comparable: boolean | null
  verificationCoverage: unknown
  verificationReason: string | null
  evidenceReference: unknown
  remainingRisk: string | null
  createdAt: string
}

export type ProductWatchDTO = {
  eligible: boolean
  canDaily: boolean
  interval: 'weekly' | 'daily' | null
  nextRunAt: string | null
  lastRunAt: string | null
  lastAttemptAt: string | null
  consecutiveFailures: number
  lastError: string | null
  latestReview: {
    id: string
    status: AuditStatus
    createdAt: string
    completedAt: string | null
    regressionCount: number | null
    notificationStatus: WatchNotificationStatus
    notificationAttempts: number
    notificationError: string | null
  } | null
}

export type ProductSignalKeyDTO = {
  id: string
  name: string
  prefix: string
  lastFour: string
  allowedOrigin: string
  lastUsedAt: string | null
  createdAt: string
}

export type ProductImprovementHistoryDTO = {
  id: string
  title: string
  status: ImprovementStatus
  updatedAt: string
  sourceReviewId: string | null
  sourceFlagId: string | null
  attempts: ProductAttemptDTO[]
}

export type ProductMemoryDTO = {
  purpose: string | null
  firstValueJourney: string | null
  verifiedLearnings: VerifiedLearning[]
  knownRisks: string[]
  intentionalNotes: string[]
}

export type ProductIntegrationDTO = {
  signalsEligible: boolean
  signalKeys: ProductSignalKeyDTO[]
  lastSignalAt: string | null
  observedContext: SynthesizedSignalContext[]
}

export type ProductWorkspaceDTO = {
  product: {
    id: string
    name: string
    url: string
    purpose: string | null
    watching: boolean
  }
  watch: ProductWatchDTO
  attention: ProductAttentionItemDTO[]
  attentionCount: number
  currentReview: ProductReviewSummaryDTO | null
  latestCompletedReview: ProductReviewSummaryDTO | null
  improvementHistory: ProductImprovementHistoryDTO[]
  memory: ProductMemoryDTO
  reviewHistory: ProductReviewSummaryDTO[]
  integrations: ProductIntegrationDTO
}

export type ProductOverviewDTO = {
  id: string
  name: string
  url: string
  purpose: string | null
  watching: boolean
  attentionCount: number
  topAttention: Pick<ProductAttentionItemDTO, 'id' | 'title' | 'status' | 'severity'> | null
  latestReview: ProductReviewSummaryDTO | null
  latestVerification: {
    outcome: VerificationOutcome
    improvementTitle: string
    verificationReviewId: string | null
  } | null
}

type ReviewRow = {
  id: string
  status: AuditStatus
  score: number | null
  reportCompleteness: ReportCompleteness
  createdAt: Date
  completedAt: Date | null
  errorMsg: string | null
  parentId: string | null
  recheckTrigger: string | null
  watchRegressionCount: number | null
  watchNotificationStatus: WatchNotificationStatus
  watchNotificationAttempts: number
  watchNotificationLastError: string | null
  flags: Array<{ status: string }>
}

function reviewSummary(review: ReviewRow): ProductReviewSummaryDTO {
  return {
    id: review.id,
    status: review.status,
    score: review.score,
    reportCompleteness: review.reportCompleteness,
    unresolvedCount: review.flags.filter(
      (flag) => flag.status === 'OPEN' || flag.status === 'REGRESSED'
    ).length,
    createdAt: review.createdAt.toISOString(),
    completedAt: review.completedAt?.toISOString() ?? null,
    failureMessage: review.errorMsg,
    isUpdateReview: review.parentId !== null,
  }
}

function attemptSummary(attempt: {
  id: string
  sourceAuditId: string
  builder: string
  changeSummary: string | null
  deploymentReference: string | null
  verificationAuditId: string | null
  outcome: VerificationOutcome | null
  testedCondition: string | null
  comparable: boolean | null
  verificationCoverage: unknown
  verificationReason: string | null
  evidenceReference: unknown
  remainingRisk: string | null
  createdAt: Date
}, sourceFlagId: string | null = null): ProductAttemptDTO {
  return {
    id: attempt.id,
    sourceReviewId: attempt.sourceAuditId,
    sourceFlagId,
    builder: attempt.builder,
    changeSummary: attempt.changeSummary,
    deploymentReference: attempt.deploymentReference,
    verificationReviewId: attempt.verificationAuditId,
    outcome: attempt.outcome,
    testedCondition: attempt.testedCondition,
    comparable: attempt.comparable,
    verificationCoverage: attempt.verificationCoverage,
    verificationReason: attempt.verificationReason,
    evidenceReference: attempt.evidenceReference,
    remainingRisk: attempt.remainingRisk,
    createdAt: attempt.createdAt.toISOString(),
  }
}

const reviewSelect = {
  id: true,
  status: true,
  score: true,
  reportCompleteness: true,
  createdAt: true,
  completedAt: true,
  errorMsg: true,
  parentId: true,
  recheckTrigger: true,
  watchRegressionCount: true,
  watchNotificationStatus: true,
  watchNotificationAttempts: true,
  watchNotificationLastError: true,
  flags: { select: { status: true } },
} as const

const attemptSelect = {
  id: true,
  sourceAuditId: true,
  builder: true,
  changeSummary: true,
  deploymentReference: true,
  verificationAuditId: true,
  outcome: true,
  testedCondition: true,
  comparable: true,
  verificationCoverage: true,
  verificationReason: true,
  evidenceReference: true,
  remainingRisk: true,
  createdAt: true,
} as const

/** Account-level Product cards. Every Review and outcome stays scoped to its Product. */
export async function loadProductOverview(userId: string): Promise<ProductOverviewDTO[]> {
  const products = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      url: true,
      productIntelligence: true,
      watchInterval: true,
      audits: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: reviewSelect,
      },
      improvements: {
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          status: true,
          occurrences: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { flag: { select: { severity: true } } },
          },
          attempts: {
            where: { outcome: { not: null } },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              outcome: true,
              verificationAuditId: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })

  return products.map((product) => {
    const memory = parseProductIntelligence(product.productIntelligence)
    const attention = product.improvements.filter((improvement) =>
      ACTIVE_IMPROVEMENT_STATUSES.includes(improvement.status)
    )
    const latestVerified = product.improvements
      .flatMap((improvement) =>
        improvement.attempts
          .filter((attempt) => attempt.outcome !== null)
          .map((attempt) => ({ improvement, attempt }))
      )
      .sort((left, right) => right.attempt.createdAt.getTime() - left.attempt.createdAt.getTime())[0]

    return {
      id: product.id,
      name: product.name,
      url: product.url,
      purpose: memory?.purpose ?? null,
      watching: product.watchInterval !== null,
      attentionCount: attention.length,
      topAttention: attention[0]
        ? {
            id: attention[0].id,
            title: attention[0].title,
            status: attention[0].status,
            severity: attention[0].occurrences[0]?.flag.severity ?? null,
          }
        : null,
      latestReview: product.audits[0] ? reviewSummary(product.audits[0]) : null,
      latestVerification:
        latestVerified?.attempt.outcome
          ? {
              outcome: latestVerified.attempt.outcome,
              improvementTitle: latestVerified.improvement.title,
              verificationReviewId: latestVerified.attempt.verificationAuditId,
            }
          : null,
    }
  })
}

/** Owner-only durable Product projection used by Product-facing transports. */
export async function loadProductWorkspace(
  productId: string,
  userId: string,
  options: { signalsEligible: boolean; canDailyWatch?: boolean }
): Promise<ProductWorkspaceDTO | null> {
  const product = await prisma.project.findFirst({
    where: { id: productId, userId },
    select: {
      id: true,
      name: true,
      url: true,
      productIntelligence: true,
      watchInterval: true,
      watchLastRunAt: true,
      watchNextRunAt: true,
      watchLastAttemptAt: true,
      watchConsecutiveFailures: true,
      watchLastError: true,
      audits: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: reviewSelect,
      },
      improvements: {
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          judgment: true,
          recommendedChange: true,
          successCondition: true,
          priority: true,
          status: true,
          updatedAt: true,
          occurrences: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              auditId: true,
              flagId: true,
              flag: {
                select: {
                  evidence: true,
                  rubric: true,
                  severity: true,
                },
              },
            },
          },
          attempts: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: attemptSelect,
          },
        },
      },
      signalKeys: {
        where: { revokedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          prefix: true,
          lastFour: true,
          allowedOrigin: true,
          lastUsedAt: true,
          createdAt: true,
        },
      },
      signals: {
        where: { occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { occurredAt: 'desc' },
        take: 500,
        select: {
          kind: true,
          name: true,
          route: true,
          sessionHash: true,
          numericValue: true,
          occurredAt: true,
          release: { select: { externalId: true } },
        },
      },
    },
  })

  if (!product) return null

  const memory = parseProductIntelligence(product.productIntelligence)
  const reviews = product.audits.map(reviewSummary)
  const attentionRows = product.improvements.filter((improvement) =>
    ACTIVE_IMPROVEMENT_STATUSES.includes(improvement.status)
  )
  const attention = attentionRows.slice(0, 3).map((improvement) => ({
    id: improvement.id,
    title: improvement.title,
    judgment: improvement.judgment,
    recommendedChange: improvement.recommendedChange,
    successCondition: improvement.successCondition,
    priority: improvement.priority,
    status: improvement.status,
    evidence: improvement.occurrences[0]?.flag.evidence ?? null,
    rubric: improvement.occurrences[0]?.flag.rubric ?? null,
    severity: improvement.occurrences[0]?.flag.severity ?? null,
    sourceReviewId: improvement.occurrences[0]?.auditId ?? null,
    sourceFlagId: improvement.occurrences[0]?.flagId ?? null,
    latestAttempt: improvement.attempts[0]
      ? attemptSummary(
          improvement.attempts[0],
          improvement.occurrences.find(
            (occurrence) => occurrence.auditId === improvement.attempts[0]?.sourceAuditId,
          )?.flagId ?? null,
        )
      : null,
  }))
  const latestWatchReview = product.audits.find((review) => review.recheckTrigger === 'WATCH')

  return {
    product: {
      id: product.id,
      name: product.name,
      url: product.url,
      purpose: memory?.purpose ?? null,
      watching: product.watchInterval !== null,
    },
    watch: {
      eligible: options.signalsEligible,
      canDaily: options.canDailyWatch ?? false,
      interval: watchInterval(product.watchInterval),
      nextRunAt: product.watchNextRunAt?.toISOString() ?? null,
      lastRunAt: product.watchLastRunAt?.toISOString() ?? null,
      lastAttemptAt: product.watchLastAttemptAt?.toISOString() ?? null,
      consecutiveFailures: product.watchConsecutiveFailures,
      lastError: product.watchLastError,
      latestReview: latestWatchReview
        ? {
            id: latestWatchReview.id,
            status: latestWatchReview.status,
            createdAt: latestWatchReview.createdAt.toISOString(),
            completedAt: latestWatchReview.completedAt?.toISOString() ?? null,
            regressionCount: latestWatchReview.watchRegressionCount,
            notificationStatus: latestWatchReview.watchNotificationStatus,
            notificationAttempts: latestWatchReview.watchNotificationAttempts,
            notificationError: latestWatchReview.watchNotificationLastError,
          }
        : null,
    },
    attention,
    attentionCount: attentionRows.length,
    currentReview: reviews[0] ?? null,
    latestCompletedReview: reviews.find((review) => review.status === 'COMPLETED') ?? null,
    improvementHistory: product.improvements.map((improvement) => ({
      id: improvement.id,
      title: improvement.title,
      status: improvement.status,
      updatedAt: improvement.updatedAt.toISOString(),
      sourceReviewId: improvement.occurrences[0]?.auditId ?? null,
      sourceFlagId: improvement.occurrences[0]?.flagId ?? null,
      attempts: improvement.attempts.map((attempt) => attemptSummary(
        attempt,
        improvement.occurrences.find(
          (occurrence) => occurrence.auditId === attempt.sourceAuditId,
        )?.flagId ?? null,
      )),
    })),
    memory: {
      purpose: memory?.purpose ?? null,
      firstValueJourney: memory?.firstValueJourney ?? null,
      verifiedLearnings: memory?.verifiedLearnings ?? [],
      knownRisks: memory?.knownRisks ?? [],
      intentionalNotes: memory?.intentionalNotes ?? [],
    },
    reviewHistory: reviews,
    integrations: {
      signalsEligible: options.signalsEligible,
      signalKeys: product.signalKeys.map((key) => ({
        ...key,
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        createdAt: key.createdAt.toISOString(),
      })),
      lastSignalAt: product.signals[0]?.occurredAt.toISOString() ?? null,
      observedContext: synthesizeProductSignals(product.signals),
    },
  }
}

function watchInterval(value: ProjectWatchInterval | null): 'weekly' | 'daily' | null {
  if (value === 'WEEKLY') return 'weekly'
  if (value === 'DAILY') return 'daily'
  return null
}
