import type {
  AuditStatus,
  ImprovementStatus,
  ProjectWatchInterval,
  RecheckTrigger,
  ReportCompleteness,
  VerificationOutcome,
  WatchNotificationStatus,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
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

export const PRODUCT_HISTORY_PAGE_SIZE = 20

export type ReviewKind = 'PRODUCT_REVIEW' | 'UPDATE_REVIEW' | 'WATCH'

export type ProductReviewSummaryDTO = {
  id: string
  kind: ReviewKind
  status: AuditStatus
  score: number | null
  reportCompleteness: ReportCompleteness
  unresolvedCount: number
  createdAt: string
  completedAt: string | null
  failureMessage: string | null
}

export type ProductWatchReviewDTO = ProductReviewSummaryDTO & {
  kind: 'WATCH'
  regressionCount: number | null
  notificationStatus: WatchNotificationStatus
  notificationAttempts: number
  notificationError: string | null
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

export type ProductIntegrationDTO = {
  signalsEligible: boolean
  signalKeys: ProductSignalKeyDTO[]
  lastSignalAt: string | null
  observedContext: SynthesizedSignalContext[]
}

export type ProductHistoryCursorDTO = {
  at: string
  id: string
}

export type ProductHistoryEventDTO =
  | {
      kind: 'review'
      at: string
      id: string
      review: ProductReviewSummaryDTO
    }
  | {
      kind: 'attempt'
      at: string
      id: string
      improvementTitle: string
      attempt: ProductAttemptDTO
    }
  | {
      kind: 'learning'
      at: string
      id: string
      learning: VerifiedLearning
    }

export type ProductHistoryPageDTO = {
  events: ProductHistoryEventDTO[]
  nextCursor: ProductHistoryCursorDTO | null
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
  activeManualReview: ProductReviewSummaryDTO | null
  latestManualReview: ProductReviewSummaryDTO | null
  latestCompletedManualReview: ProductReviewSummaryDTO | null
  latestWatchReview: ProductWatchReviewDTO | null
  history: ProductHistoryPageDTO
  integrations: ProductIntegrationDTO
}

export type ProductOverviewDTO = {
  id: string
  name: string
  url: string
  purpose: string | null
  watching: boolean
  attentionCount: number
  topAttention: Pick<
    ProductAttentionItemDTO,
    'id' | 'title' | 'status' | 'severity'
  > | null
  latestManualReview: ProductReviewSummaryDTO | null
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
  recheckTrigger: RecheckTrigger | null
  watchRegressionCount: number | null
  watchNotificationStatus: WatchNotificationStatus
  watchNotificationAttempts: number
  watchNotificationLastError: string | null
  flags: Array<{ status: string }>
}

type AttemptRow = {
  id: string
  improvementId: string
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
  improvement: { title: string }
}

const HISTORY_PREFIXES = ['review:', 'attempt:', 'learning:'] as const

function reviewKind(
  review: Pick<ReviewRow, 'parentId' | 'recheckTrigger'>,
): ReviewKind {
  if (review.recheckTrigger === 'WATCH') return 'WATCH'
  return review.parentId ? 'UPDATE_REVIEW' : 'PRODUCT_REVIEW'
}

function reviewSummary(review: ReviewRow): ProductReviewSummaryDTO {
  return {
    id: review.id,
    kind: reviewKind(review),
    status: review.status,
    score: review.score,
    reportCompleteness: review.reportCompleteness,
    unresolvedCount: review.flags.filter(
      (flag) => flag.status === 'OPEN' || flag.status === 'REGRESSED',
    ).length,
    createdAt: review.createdAt.toISOString(),
    completedAt: review.completedAt?.toISOString() ?? null,
    failureMessage: review.errorMsg,
  }
}

function watchReviewSummary(review: ReviewRow): ProductWatchReviewDTO {
  return {
    ...reviewSummary(review),
    kind: 'WATCH',
    regressionCount: review.watchRegressionCount,
    notificationStatus: review.watchNotificationStatus,
    notificationAttempts: review.watchNotificationAttempts,
    notificationError: review.watchNotificationLastError,
  }
}

function evidenceBeforeFlagId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const beforeFlagId = (value as { beforeFlagId?: unknown }).beforeFlagId
  return typeof beforeFlagId === 'string' && beforeFlagId.length > 0
    ? beforeFlagId
    : null
}

function attemptSummary(
  attempt: AttemptRow,
  sourceFlagId: string | null,
): ProductAttemptDTO {
  return {
    id: attempt.id,
    sourceReviewId: attempt.sourceAuditId,
    sourceFlagId:
      evidenceBeforeFlagId(attempt.evidenceReference) ?? sourceFlagId,
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
  improvementId: true,
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
  improvement: { select: { title: true } },
} as const

function manualReviewWhere() {
  return {
    OR: [{ recheckTrigger: null }, { recheckTrigger: 'MANUAL' as const }],
  }
}

function stableLearningId(learning: VerifiedLearning): string {
  const identity =
    learning.attemptId ??
    learning.improvementId ??
    learning.checkId ??
    learning.summary
  let hash = 2166136261
  for (const character of identity) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `learning:${learning.auditId}:${(hash >>> 0).toString(36)}`
}

export function parseProductHistoryCursor(
  value: string | undefined,
): ProductHistoryCursorDTO | null {
  if (!value || value.length > 500) return null
  const separatorIndex = value.indexOf('|')
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null
  const atValue = value.slice(0, separatorIndex)
  const idValue = value.slice(separatorIndex + 1)
  if (!atValue || !idValue || idValue.length > 300) return null
  if (!HISTORY_PREFIXES.some((prefix) => idValue.startsWith(prefix)))
    return null
  const at = new Date(atValue)
  if (Number.isNaN(at.getTime())) return null
  return { at: at.toISOString(), id: idValue }
}

export function serializeProductHistoryCursor(
  cursor: ProductHistoryCursorDTO,
): string {
  return `${cursor.at}|${cursor.id}`
}

function historyDateWhere(
  prefix: 'review:' | 'attempt:',
  cursor: ProductHistoryCursorDTO | null,
) {
  if (!cursor) return {}
  const at = new Date(cursor.at)
  const cursorPrefix = HISTORY_PREFIXES.find((candidate) =>
    cursor.id.startsWith(candidate),
  )
  if (!cursorPrefix) return {}
  const prefixOrder = prefix.localeCompare(cursorPrefix)
  if (prefixOrder < 0) return { createdAt: { lte: at } }
  if (prefixOrder > 0) return { createdAt: { lt: at } }
  return {
    OR: [
      { createdAt: { lt: at } },
      { createdAt: at, id: { lt: cursor.id.slice(prefix.length) } },
    ],
  }
}

function compareHistoryEvents(
  left: ProductHistoryEventDTO,
  right: ProductHistoryEventDTO,
): number {
  const dateOrder = right.at.localeCompare(left.at)
  return dateOrder || right.id.localeCompare(left.id)
}

function eventIsBeforeCursor(
  event: ProductHistoryEventDTO,
  cursor: ProductHistoryCursorDTO | null,
): boolean {
  if (!cursor) return true
  return (
    event.at < cursor.at || (event.at === cursor.at && event.id < cursor.id)
  )
}

/** Account-level Product cards. Every manual Review and Attention item stays scoped to its Product. */
export async function loadProductOverview(
  userId: string,
): Promise<ProductOverviewDTO[]> {
  const products = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      name: true,
      url: true,
      productIntelligence: true,
      watchInterval: true,
      audits: {
        where: manualReviewWhere(),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: reviewSelect,
      },
      improvements: {
        where: { status: { in: ACTIVE_IMPROVEMENT_STATUSES } },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          status: true,
          occurrences: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { flag: { select: { severity: true } } },
          },
        },
      },
    },
  })

  for (const product of products) {
    if (product.userId !== userId) {
      logger.error(
        'SECURITY: loadProductOverview returned product owned by different user',
        {
          requestedUserId: userId,
          actualUserId: product.userId,
          productId: product.id,
        },
      )
    }
  }

  return products.map((product) => {
    const memory = parseProductIntelligence(product.productIntelligence)
    return {
      id: product.id,
      name: product.name,
      url: product.url,
      purpose: memory?.purpose ?? null,
      watching: product.watchInterval !== null,
      attentionCount: product.improvements.length,
      topAttention: product.improvements[0]
        ? {
            id: product.improvements[0].id,
            title: product.improvements[0].title,
            status: product.improvements[0].status,
            severity:
              product.improvements[0].occurrences[0]?.flag.severity ?? null,
          }
        : null,
      latestManualReview: product.audits[0]
        ? reviewSummary(product.audits[0])
        : null,
    }
  })
}

/** Owner-only durable Product projection used by Product-facing transports. */
export async function loadProductWorkspace(
  productId: string,
  userId: string,
  options: {
    signalsEligible: boolean
    canDailyWatch?: boolean
    historyCursor?: ProductHistoryCursorDTO | null
  },
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
      improvements: {
        where: { status: { in: ACTIVE_IMPROVEMENT_STATUSES } },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          judgment: true,
          recommendedChange: true,
          successCondition: true,
          priority: true,
          status: true,
          occurrences: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
        where: {
          occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
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

  const historyCursor = options.historyCursor ?? null
  const [
    activeManualReviewRow,
    latestManualReviewRow,
    latestCompletedManualReviewRow,
    latestWatchReviewRow,
    historyReviewRows,
    historyAttemptRows,
  ] = await Promise.all([
    prisma.audit.findFirst({
      where: {
        projectId: product.id,
        status: { notIn: ['COMPLETED', 'FAILED'] },
        ...manualReviewWhere(),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: reviewSelect,
    }),
    prisma.audit.findFirst({
      where: { projectId: product.id, ...manualReviewWhere() },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: reviewSelect,
    }),
    prisma.audit.findFirst({
      where: {
        projectId: product.id,
        status: 'COMPLETED',
        ...manualReviewWhere(),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: reviewSelect,
    }),
    prisma.audit.findFirst({
      where: { projectId: product.id, recheckTrigger: 'WATCH' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: reviewSelect,
    }),
    prisma.audit.findMany({
      where: {
        projectId: product.id,
        ...historyDateWhere('review:', historyCursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PRODUCT_HISTORY_PAGE_SIZE + 1,
      select: reviewSelect,
    }),
    prisma.improvementAttempt.findMany({
      where: {
        improvement: { projectId: product.id },
        ...historyDateWhere('attempt:', historyCursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PRODUCT_HISTORY_PAGE_SIZE + 1,
      select: attemptSelect,
    }),
  ])

  const sourceReviewIds = [
    ...new Set(historyAttemptRows.map((attempt) => attempt.sourceAuditId)),
  ]
  const sourceOccurrences =
    sourceReviewIds.length > 0
      ? await prisma.improvementOccurrence.findMany({
          where: {
            improvement: { projectId: product.id },
            auditId: { in: sourceReviewIds },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            improvementId: true,
            auditId: true,
            flagId: true,
          },
        })
      : []
  const sourceFlagIds = new Map<string, string>()
  for (const occurrence of sourceOccurrences) {
    const key = `${occurrence.improvementId}:${occurrence.auditId}`
    if (!sourceFlagIds.has(key)) sourceFlagIds.set(key, occurrence.flagId)
  }

  const memory = parseProductIntelligence(product.productIntelligence)
  const reviewEvents = historyReviewRows.map(
    (review): ProductHistoryEventDTO => ({
      kind: 'review',
      at: review.createdAt.toISOString(),
      id: `review:${review.id}`,
      review: reviewSummary(review),
    }),
  )
  const attemptEvents = historyAttemptRows.map(
    (attempt): ProductHistoryEventDTO => ({
      kind: 'attempt',
      at: attempt.createdAt.toISOString(),
      id: `attempt:${attempt.id}`,
      improvementTitle: attempt.improvement.title,
      attempt: attemptSummary(
        attempt,
        sourceFlagIds.get(
          `${attempt.improvementId}:${attempt.sourceAuditId}`,
        ) ?? null,
      ),
    }),
  )
  const learningEvents = (memory?.verifiedLearnings ?? []).map(
    (learning): ProductHistoryEventDTO => ({
      kind: 'learning',
      at: learning.at,
      id: stableLearningId(learning),
      learning,
    }),
  )
  const historyCandidates = [
    ...reviewEvents,
    ...attemptEvents,
    ...learningEvents,
  ]
    .filter((event) => eventIsBeforeCursor(event, historyCursor))
    .sort(compareHistoryEvents)
  const historyEvents = historyCandidates.slice(0, PRODUCT_HISTORY_PAGE_SIZE)
  const lastHistoryEvent = historyEvents.at(-1)
  const nextCursor =
    historyCandidates.length > PRODUCT_HISTORY_PAGE_SIZE && lastHistoryEvent
      ? { at: lastHistoryEvent.at, id: lastHistoryEvent.id }
      : null

  const attention = product.improvements.slice(0, 3).map((improvement) => ({
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
  }))

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
    },
    attention,
    attentionCount: product.improvements.length,
    activeManualReview: activeManualReviewRow
      ? reviewSummary(activeManualReviewRow)
      : null,
    latestManualReview: latestManualReviewRow
      ? reviewSummary(latestManualReviewRow)
      : null,
    latestCompletedManualReview: latestCompletedManualReviewRow
      ? reviewSummary(latestCompletedManualReviewRow)
      : null,
    latestWatchReview: latestWatchReviewRow
      ? watchReviewSummary(latestWatchReviewRow)
      : null,
    history: {
      events: historyEvents,
      nextCursor,
    },
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

function watchInterval(
  value: ProjectWatchInterval | null,
): 'weekly' | 'daily' | null {
  if (value === 'WEEKLY') return 'weekly'
  if (value === 'DAILY') return 'daily'
  return null
}
