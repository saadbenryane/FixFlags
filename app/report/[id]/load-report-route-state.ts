import { notFound, redirect } from 'next/navigation'
import {
  getGatedAuditForRequest,
  getProgressiveAuditForRequest,
  resolveActiveAttachedWorkId,
} from '@/lib/audit/fetch-audit'
import { prisma } from '@/lib/db'
import { getEntitlements, hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { getEffectiveScanLimit, getPendingCheckCount, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { isAtCheckLimit } from '@/lib/audit/usage'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { toRankableFlag } from '@/lib/audit/load-finish-plan-flags'
import { historyPointFromAudit } from '@/lib/report/workspace-model'
import { buildFixList } from '@/lib/audit/finish-plan'
import { loadVerificationReceiptsForReview } from '@/lib/products/workspace'
import type { ReportWorkspaceAuditDTO } from '@/lib/report/workspace'
import { buildLiveExplorerModel, buildPartialExplorerModel } from '@/lib/report/explorer-model'
import { buildReviewWorkspaceProjection } from '@/lib/report/review-workspace-projection'
import { buildFixFlagsScanMessages } from '@/lib/audit/scan-agent-messages'
import { previousScoreFromHistory } from '@/lib/audit/update-review-progress'

const MAX_REVIEW_HISTORY_HOPS = 60

const completedHistorySelect = {
  id: true,
  userId: true,
  projectId: true,
  parentId: true,
  recheckTrigger: true,
  score: true,
  status: true,
  createdAt: true,
  completedAt: true,
} as const

type CompletedHistoryRow = {
  id: string
  userId: string | null
  projectId: string | null
  parentId: string | null
  recheckTrigger: string | null
  score: number | null
  status: string
  createdAt: Date
  completedAt: Date | null
}

/**
 * Load only Reviews belonging to this Product. Project-backed Reviews use the
 * durable Product identity; legacy rows walk their bounded parent tree instead
 * of scanning an account-wide history window.
 */
export async function loadCompletedReviewHistoryRows(input: {
  auditId: string
  userId: string
  projectId: string | null
}): Promise<CompletedHistoryRow[]> {
  if (input.projectId) {
    return prisma.audit.findMany({
      where: {
        projectId: input.projectId,
        userId: input.userId,
        status: 'COMPLETED',
      },
      select: completedHistorySelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
  }

  const rows = new Map<string, CompletedHistoryRow>()
  let cursorId: string | null = input.auditId
  let rootId = input.auditId
  let hops = 0

  while (cursorId && hops < MAX_REVIEW_HISTORY_HOPS) {
    const row: CompletedHistoryRow | null = await prisma.audit.findUnique({
      where: { id: cursorId },
      select: completedHistorySelect,
    })
    if (!row || row.userId !== input.userId) break
    if (row.status === 'COMPLETED') rows.set(row.id, row)
    rootId = row.id
    cursorId = row.parentId
    hops += 1
  }

  let frontier = [rootId]
  hops = 0
  while (frontier.length > 0 && hops < MAX_REVIEW_HISTORY_HOPS) {
    const children: CompletedHistoryRow[] = await prisma.audit.findMany({
      where: {
        parentId: { in: frontier },
        userId: input.userId,
        status: 'COMPLETED',
      },
      select: completedHistorySelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const next: string[] = []
    for (const row of children) {
      if (rows.has(row.id)) continue
      rows.set(row.id, row)
      next.push(row.id)
    }
    frontier = next
    hops += 1
  }

  return [...rows.values()]
}

export async function loadReportRouteState(
  params: Promise<{ id: string }>,
  shareToken?: string
) {
  const { id: requestedId } = await params
  const activeWorkId = await resolveActiveAttachedWorkId(requestedId)
  if (activeWorkId !== requestedId) {
    redirect(`/report/${encodeURIComponent(activeWorkId)}`)
  }
  const id = requestedId
  const progressive = await getProgressiveAuditForRequest(id)

  if (progressive.kind === 'not_found') {
    notFound()
  }

  if (progressive.kind === 'forbidden') {
    return { kind: 'forbidden' as const }
  }

  if (progressive.kind === 'progressive') {
    const progressiveUser = progressive.session?.user
      ? await prisma.user.findUnique({
          where: { id: progressive.session.user.id },
          select: {
            id: true,
            plan: true,
            role: true,
            subscriptionStatus: true,
            auditsUsed: true,
            auditsLimit: true,
          },
        })
      : null
    const progressivePending = progressiveUser
      ? await getPendingCheckCount(progressiveUser.id)
      : 0
    const progressiveEffectiveLimit = progressiveUser
      ? getEffectiveScanLimit(progressiveUser)
      : 3
    const progressiveIsEffectivelyFree =
      progressiveUser?.plan === 'FREE' ||
      (progressiveUser
        ? hasRevokedSubscriptionStatus(progressiveUser.subscriptionStatus)
        : true)
    const progressiveAtAuditLimit =
      progressiveIsEffectivelyFree &&
      !!progressiveUser &&
      !isUnlimitedScanLimit(progressiveEffectiveLimit) &&
      isAtCheckLimit(progressiveUser.auditsUsed, progressivePending, progressiveEffectiveLimit)

    const routeKind: 'failed' | 'running' =
      progressive.audit.status === 'FAILED' ? 'failed' : 'running'
    const projection = buildReviewWorkspaceProjection({
      kind: routeKind,
      explorer: buildPartialExplorerModel({
        url: progressive.audit.url,
        pageType: progressive.audit.pageType,
        score: progressive.audit.score,
        flags: progressive.audit.flags,
        screenshots: progressive.audit.screenshots,
        rubrics: progressive.audit.rubrics,
        promptAccess: progressive.capabilities.canViewPromptBodies ? 'all' : 'none',
      }),
      visibility: progressive.accessContext,
      isAuthenticated: Boolean(progressive.session?.user),
      reviewId: progressive.audit.id,
      parentId: progressive.audit.parentId,
      url: progressive.audit.url,
      pageType: progressive.audit.pageType,
      loading: progressive.audit.status !== 'FAILED',
      agentMessages: buildFixFlagsScanMessages({
        id: progressive.audit.id,
        url: progressive.audit.url,
        status: progressive.audit.status,
        progress: progressive.audit.progress,
        startedAt: progressive.audit.startedAt,
        completedAt: progressive.audit.completedAt,
        failureCode: progressive.audit.failureCode,
        reportCompleteness: progressive.audit.reportCompleteness,
        flags: progressive.audit.flags,
        pages: progressive.audit.pages,
      }),
    })
    return {
      kind: routeKind,
      projection,
      id: progressive.audit.id,
      audit: {
        ...progressive.audit,
        accessContext: progressive.accessContext,
      },
      session: progressive.session,
      atAuditLimit: progressiveAtAuditLimit,
    }
  }

  const result = await getGatedAuditForRequest(id)

  if (result.kind === 'not_found') {
    notFound()
  }

  if (result.kind === 'forbidden') {
    return { kind: 'forbidden' as const }
  }

  const {
    audit,
    accessContext,
    isLoggedIn,
    session,
    showPrescription,
    showDeterministicFixes,
    aiReviewPending,
    triageDegraded,
    prescriptionFailed,
    sampleFixFlag,
  } = result
  const isOwner = accessContext === 'owner'
  const isMarketingSample = false

  const [
    user,
    latestMonitoring,
    recheckDiff,
    completedHistoryRows,
    verificationReceipts,
  ] = await Promise.all([
    session?.user
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            plan: true,
            role: true,
            subscriptionStatus: true,
            auditsUsed: true,
            auditsLimit: true,
          },
        })
      : Promise.resolve(null),
    session?.user && !audit.parentId
      ? prisma.audit.findFirst({
          where: {
            parentId: id,
            userId: session.user.id,
            status: 'COMPLETED',
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
      : Promise.resolve(null),
    audit.status === 'COMPLETED' && audit.parentId
      ? getFlagDiffSummary(audit.parentId, id)
      : Promise.resolve(null),
    isOwner && audit.userId
      ? loadCompletedReviewHistoryRows({
          auditId: id,
          userId: audit.userId,
          projectId: audit.projectId,
        })
      : Promise.resolve([]),
    isOwner && audit.userId && audit.status === 'COMPLETED' && Boolean(audit.parentId)
      ? loadVerificationReceiptsForReview(id, audit.userId)
      : Promise.resolve([]),
  ])
  // Keep no-score observations so degraded/partial captures show as hollow
  // spine bars instead of vanishing from history.
  const scoreHistory = completedHistoryRows
    .sort(
      (left, right) =>
        (left.completedAt ?? left.createdAt).getTime() -
        (right.completedAt ?? right.createdAt).getTime()
    )
    .map((row) =>
      historyPointFromAudit({
        id: row.id,
        score: row.score,
        checkedAt: row.completedAt ?? row.createdAt,
        parentId: row.parentId,
        recheckTrigger: row.recheckTrigger,
      })
    )

  const pending = user ? await getPendingCheckCount(user.id) : 0
  const effectiveLimit = user ? getEffectiveScanLimit(user) : 3
  const isEffectivelyFree =
    user?.plan === 'FREE' || (user ? hasRevokedSubscriptionStatus(user.subscriptionStatus) : true)
  const atAuditLimit =
    isEffectivelyFree &&
    !!user &&
    !isUnlimitedScanLimit(effectiveLimit) &&
    isAtCheckLimit(user.auditsUsed, pending, effectiveLimit)

  const entitlements = user && session
    ? getEntitlements({
        id: session.user.id,
        role: user.role,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
      })
    : null

  const viewerIsPaid = entitlements?.canAccessPaidFeatures ?? false

  if (audit.status === 'COMPLETED') {
    const rubricRows = (audit.rubricRows as Array<{
      id: string
      name: string
      grade: string
      score: number | null
      status: string | null
      summary: string
      rubricPrompt: string | null
      flags: Array<{
        id: string
        checkId: string
        rubric: string
        severity: string
        impactTag: string | null
        problem: string
        evidence: string
        whyItMatters: string
        fix: string
        agentPrompt: string | null
        cursorPrompt: string | null
        claudePrompt: string | null
        windsurfPrompt: string | null
        lovablePrompt: string | null
        boltPrompt: string | null
        verificationRule: string | null
        pageUrl: string | null
        affectedPaths?: unknown
        confidence: number | null
        source?: string | null
        evidenceTargets?: unknown
      }>
    }> | undefined ?? []).map((row) => ({
      ...row,
      flags: row.flags.map((f) => ({
        ...f,
        source: f.source ?? undefined,
      })),
    }))

    const flags = audit.flags.map((f) => ({
      id: f.id,
      checkId: f.checkId,
      rubric: f.rubric,
      severity: f.severity,
      impactTag: f.impactTag,
      problem: f.problem,
      evidence: f.evidence,
      whyItMatters: f.whyItMatters,
      fix: f.fix,
      agentPrompt: f.agentPrompt,
      cursorPrompt: f.cursorPrompt,
      claudePrompt: f.claudePrompt,
      windsurfPrompt: f.windsurfPrompt,
      lovablePrompt: f.lovablePrompt,
      boltPrompt: f.boltPrompt,
      verificationRule: f.verificationRule,
      pageUrl: f.pageUrl,
      affectedPaths: f.affectedPaths,
      confidence: f.confidence,
      source: f.source ?? undefined,
      status: f.status,
      evidenceTargets: f.evidenceTargets,
    }))

    const allFlags = flags.map(toRankableFlag)
    const fixList = buildFixList({
      flags: allFlags,
      rubricRows,
      url: audit.url,
      pageType: audit.pageType,
      contract: audit.productContract,
      promptAccess: showDeterministicFixes ? 'all' : sampleFixFlag ? 'one' : 'none',
      demonstratedFlag: sampleFixFlag,
    })
    const flagsById = new Map(allFlags.map((flag) => [flag.id, flag]))
    const canonicalFlags = fixList.items.flatMap((item) => {
      const source = flagsById.get(item.id)
      return source
        ? [{
            ...source,
            checkId: item.checkId,
            rubric: item.rubricName,
            severity: item.severity,
            impactTag: item.impactTag,
            problem: item.problem,
            evidence: item.evidence,
            whyItMatters: item.whyItMatters ?? undefined,
            verificationRule: item.verificationRule ?? undefined,
            pageUrl: item.pageUrl ?? undefined,
          }]
        : []
    })
    const reportAudit: ReportWorkspaceAuditDTO = {
      accessContext,
      pageType: audit.pageType,
      score: audit.score,
      url: audit.url,
      screenshots: audit.screenshots,
      rubricRows,
      flags: canonicalFlags,
      reportCompleteness: audit.reportCompleteness,
      reviewCoverage: audit.reviewCoverage,
      completedAt: audit.completedAt,
      parentId: audit.parentId,
      previewMeta: audit.previewMeta,
      evidenceAnchors: audit.evidenceAnchors,
      flagVisualEvidence: audit.flagVisualEvidence,
      productContract: audit.productContract,
      failedModules: Array.isArray(audit.failedModules)
        ? audit.failedModules.filter((module): module is string => typeof module === 'string')
        : [],
      fixList,
    }
    const explorer = buildLiveExplorerModel({
      url: reportAudit.url,
      pageType: reportAudit.pageType,
      score: reportAudit.score,
      flags: reportAudit.flags,
      screenshots: reportAudit.screenshots,
      rubricRows: reportAudit.rubricRows,
      evidenceAnchors: reportAudit.evidenceAnchors,
      previewMeta: reportAudit.previewMeta,
      flagVisualEvidence: reportAudit.flagVisualEvidence,
      productContract: reportAudit.productContract ?? null,
      promptAccess: showDeterministicFixes ? 'all' : 'none',
      fixList: reportAudit.fixList,
      reviewCoverage: reportAudit.reviewCoverage,
      reportCompleteness: reportAudit.reportCompleteness,
    })
    const agentMessages = buildFixFlagsScanMessages({
      id,
      url: audit.url,
      status: audit.status,
      progress: audit.progress,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      reportCompleteness: audit.reportCompleteness,
      failureCode: audit.failureCode,
      journeyReviewIncluded: audit.journeyReviewIncluded,
      journeyReviewAt: audit.journeyReviewAt,
      screenshotCapture: audit.screenshotCapture,
      score: audit.score,
      previousScore: previousScoreFromHistory(scoreHistory, id),
      updateDiff: recheckDiff,
      flags: canonicalFlags.map((flag) => ({
        id: flag.id,
        problem: flag.problem,
        rubric: flag.rubric,
        severity: flag.severity,
        checkId: flag.checkId,
        impactTag: flag.impactTag,
        pageUrl: flag.pageUrl,
        confidence: flag.confidence,
        status: flag.status,
        fix: flag.fix,
      })),
    })
    const projectionKind: 'partial' | 'completed' =
      reportAudit.reportCompleteness === 'PARTIAL' ? 'partial' : 'completed'
    const projection = buildReviewWorkspaceProjection({
      kind: projectionKind,
      explorer,
      visibility: accessContext,
      isAuthenticated: isLoggedIn,
      reviewId: id,
      parentId: audit.parentId,
      url: audit.url,
      pageType: audit.pageType,
      checkedAt: audit.completedAt,
      freshComparableUpdate:
        Boolean(audit.parentId) && audit.reportCompleteness === 'FULL',
      history: scoreHistory,
      updateDiff: recheckDiff,
      agentMessages,
      dataGaps: reportAudit.failedModules ?? [],
    })

    return {
      kind: projectionKind,
      projection,
      id,
      audit,
      session,
      user,
      isLoggedIn,
      isOwner,
      isMarketingSample,
      showPrescription,
      showDeterministicFixes,
      aiReviewPending,
      triageDegraded,
      prescriptionFailed,
      sampleFixFlag: sampleFixFlag as typeof flags[number] | null,
      latestMonitoring,
      recheckDiff,
      verificationReceipts,
      scoreHistory,
      atAuditLimit,
      entitlements,
      viewerIsPaid,
      rubricRows,
      flags: canonicalFlags,
      reportAudit,
      shareToken,
    }
  }
  // The lightweight read observed COMPLETED. If the row changed underneath the
  // completed loader, render its latest state rather than assembling a partial
  // completed report.
  const routeKind: 'failed' | 'running' =
    audit.status === 'FAILED' ? 'failed' : 'running'
  const projection = buildReviewWorkspaceProjection({
    kind: routeKind,
    explorer: buildPartialExplorerModel({
      url: audit.url,
      pageType: audit.pageType,
      score: audit.score,
      flags: audit.flags,
      screenshots: audit.screenshots,
      rubrics: audit.rubrics.map((rubric) => ({
        name: rubric.name,
        score: rubric.score ?? null,
        grade: rubric.grade ?? null,
      })),
      promptAccess: result.capabilities.canViewPromptBodies ? 'all' : 'none',
    }),
    visibility: accessContext,
    isAuthenticated: isLoggedIn,
    reviewId: id,
    parentId: audit.parentId,
    url: audit.url,
    pageType: audit.pageType,
    loading: audit.status !== 'FAILED',
  })
  return {
    kind: routeKind,
    projection,
    id,
    audit: {
      ...audit,
      accessContext,
    },
    session,
  }
}
