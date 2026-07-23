import { notFound } from 'next/navigation'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'
import { prisma } from '@/lib/db'
import { getEntitlements, canAccessCompare, hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { getEffectiveScanLimit, getPendingCheckCount, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { isAtCheckLimit } from '@/lib/audit/usage'
import { isPublicMarketingSample } from '@/lib/audit/report-access'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { assembleReportViewModel } from '@/lib/report/report-view-model'
import { buildUnifiedFinishPlan } from '@/lib/audit/load-finish-plan-flags'
import { parseProductContract } from '@/lib/audit/product-contract'
import { loadFinishPlanFlags } from '@/lib/audit/load-finish-plan-flags'

function topIssueFromFlags(
  flags: Array<{ severity: string; problem: string }>
): string | undefined {
  return flags.find((f) => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT')?.problem
}

export async function loadReportRouteState(
  params: Promise<{ id: string }>,
  shareToken?: string
) {
  const { id } = await params
  const result = await getGatedAuditForRequest(id)

  if (result.kind === 'not_found') {
    notFound()
  }

  if (result.kind === 'forbidden') {
    return { kind: 'forbidden' as const }
  }

  const { audit, accessContext, isLoggedIn, session, showPrescription, showDeterministicFixes, aiReviewPending, triageDegraded, prescriptionFailed, sampleFixFlag } = result
  const isOwner = accessContext === 'owner'
  const isAnonymous = audit.userId === null
  const isMarketingSample = isPublicMarketingSample({
    userId: audit.userId,
    aiReviewAt: audit.aiReviewAt,
    isPublic: audit.isPublic,
  })
  const topIssue = topIssueFromFlags(audit.flags)

  const [user, latestMonitoring, recheckDiff] = await Promise.all([
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
  ])

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

  const compareMonitoringAudit = audit.parentId
    ? { parentId: audit.parentId, userId: session?.user?.id ?? null }
    : latestMonitoring
      ? { parentId: id, userId: session?.user?.id ?? null }
      : null

  const canAccessCompareView =
    user && compareMonitoringAudit
      ? canAccessCompare(user)
      : false

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
        confidence: number | null
        source?: string | null
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
      confidence: f.confidence,
      source: f.source ?? undefined,
    }))

    const allFlags = await loadFinishPlanFlags({
      userId: audit.userId,
      auditUrl: audit.url,
      flags,
    })

    const reportAudit = {
      pageType: audit.pageType,
      verdict: audit.verdict,
      score: audit.score,
      url: audit.url,
      screenshots: audit.screenshots,
      screenshotCapture: audit.screenshotCapture,
      rubrics: audit.rubrics,
      rubricRows,
      flags: allFlags,
      shareStatus: audit.shareStatus,
      launchReadiness: audit.launchReadiness,
      reportCompleteness: audit.reportCompleteness,
      pipelineVersion: audit.pipelineVersion,
      pipelineLog: audit.pipelineLog,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      parentId: audit.parentId,
      pageSpeedErrors: audit.pageSpeedErrors,
      previewMeta: audit.previewMeta,
      flowData: audit.flowData,
      evidenceAnchors: audit.evidenceAnchors,
      flagVisualEvidence: audit.flagVisualEvidence,
      productContract: audit.productContract,
      verifiedLearnings: audit.verifiedLearnings,
      intentionalNotes: audit.intentionalNotes,
      knownRisks: audit.knownRisks,
      actionTimeline: audit.actionTimeline,
    }

    const contract = parseProductContract(audit.productContract)
    const promptAccess = showDeterministicFixes ? 'all' : sampleFixFlag ? 'one' : 'none'
    const finishPlan = await buildUnifiedFinishPlan({
      userId: audit.userId,
      auditUrl: audit.url,
      flags,
      rubricRows: audit.rubrics.map((rubric) => ({
        name: rubric.name,
        grade: rubric.grade ?? null,
      })),
      contract,
      promptAccess,
      demonstratedFlag: sampleFixFlag as typeof flags[number] | null,
    })

    const focusedModel = assembleReportViewModel({
      auditId: id,
      audit: reportAudit,
      isLoggedIn,
      isOwner,
      isAnonymous,
      showPrompts: showDeterministicFixes,
      demonstratedFlag: sampleFixFlag as typeof flags[number] | null,
      recheckDiff,
      compareHref: canAccessCompareView && audit.parentId ? `/compare/${id}` : null,
      detailsHref: shareToken ? `/share/${shareToken}/details` : undefined,
      finishPlan,
    })

    return {
      kind: 'completed' as const,
      id,
      audit,
      session,
      user,
      isLoggedIn,
      isOwner,
      isAnonymous,
      isMarketingSample,
      showPrescription,
      showDeterministicFixes,
      aiReviewPending,
      triageDegraded,
      prescriptionFailed,
      sampleFixFlag: sampleFixFlag as typeof flags[number] | null,
      latestMonitoring,
      recheckDiff,
      atAuditLimit,
      entitlements,
      canAccessCompareView,
      viewerIsPaid,
      rubricRows,
      flags,
      finishPlanFlags: allFlags,
      finishPlan,
      reportAudit,
      focusedModel,
      topIssue,
      shareToken,
    }
  }

  return { kind: 'progressive' as const, id, audit, session }
}
