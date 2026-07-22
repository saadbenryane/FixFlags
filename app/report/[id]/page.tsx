import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AuditPageClient } from '@/components/audit/AuditPageClient'
import { FocusedAuditReport } from '@/components/audit/FocusedAuditReport'
import { AuditShell } from '@/components/layout/audit-shell'
import { ReportAccessDeniedStatus } from '@/components/ui/status-page'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'
import { prisma } from '@/lib/db'
import { getEntitlements, canAccessCompare, hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { isAdminUser, getEffectiveScanLimit, getPendingCheckCount, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { isAtCheckLimit } from '@/lib/audit/usage'
import { McpFixNudge } from '@/components/audit/McpFixNudge'
import { AiReviewPendingRefresh } from '@/components/audit/AiReviewPendingRefresh'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { canAccessAudit } from '@/lib/audit/access'
import { isPublicMarketingSample } from '@/lib/audit/report-access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { displayHostname } from '@/lib/utils/url-helpers'
import { assembleReportViewModel } from '@/lib/report/report-view-model'

interface Props {
  params: Promise<{ id: string }>
}

function topIssueFromFlags(
  flags: Array<{ severity: string; problem: string }>
): string | undefined {
  return flags.find((f) => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT')?.problem
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const session = await resolveSessionUser()

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: {
      url: true,
      score: true,
      verdict: true,
      status: true,
      userId: true,
      isPublic: true,
      flags: {
        select: { severity: true, problem: true },
        orderBy: { position: 'asc' },
        take: 5,
      },
    },
  })

  if (!audit || audit.status !== 'COMPLETED') {
    return { title: 'FixFlags report' }
  }

  const isShareableOg = audit.isPublic || audit.userId === null

  if (!isShareableOg) {
    return {
      title: 'Private report',
      description: `Sign in to view this ${BRAND.name} report.`,
      robots: { index: false, follow: false },
    }
  }

  if (!canAccessAudit(audit, session?.user) && !audit.isPublic && audit.userId) {
    return { title: 'FixFlags report' }
  }

  const hostname = displayHostname(audit.url)

  const topIssue = topIssueFromFlags(audit.flags)
  const title = audit.score != null
    ? `${hostname} - ${audit.score}/100 · ${BRAND.name}`
    : `${hostname} report · ${BRAND.name}`
  const description = topIssue
    ? `${topIssue}. Run your own check at ${BRAND.name}.`
    : audit.verdict?.slice(0, 140) ??
      `Automated FixFlags report with fix prompts. Run your own check at ${BRAND.name}.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/report/${id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}/report/${id}`,
      siteName: BRAND.name,
      images: [{ url: `/report/${id}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/report/${id}/opengraph-image`],
    },
  }
}

export async function loadReportRouteState(params: Props['params'], shareToken?: string) {
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

  // Parallelize independent post-gate reads to cut report TTFB.
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
  // A revoked subscription is treated the same as FREE here - see the identical comment in
  // app/(app)/dashboard/page.tsx - so the upgrade nudge isn't hidden from someone whose plan
  // field hasn't been resynced yet but who is no longer actually paying.
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

    const reportAudit = {
      pageType: audit.pageType,
      verdict: audit.verdict,
      score: audit.score,
      url: audit.url,
      screenshots: audit.screenshots,
      screenshotCapture: audit.screenshotCapture,
      rubrics: audit.rubrics,
      rubricRows,
      flags,
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
      reportAudit,
      focusedModel,
      topIssue,
      shareToken,
    }
  }

  return { kind: 'progressive' as const, id, audit, session }
}

export async function ReportRoute({ params, shareToken }: Props & { shareToken?: string }) {
  const state = await loadReportRouteState(params, shareToken)
  if (state.kind === 'forbidden') {
    return <AuditShell session={null}><ReportAccessDeniedStatus /></AuditShell>
  }
  if (state.kind === 'progressive') {
    return <AuditPageClient id={state.id} initialAudit={state.audit} pollStatus session={state.session} />
  }

  return (
    <AuditShell
      session={state.session}
      showAdmin={state.user && state.session
        ? isAdminUser({ id: state.session.user.id, role: state.user.role })
        : false}
    >
      <FocusedAuditReport model={state.focusedModel} />
      <McpFixNudge auditId={state.id} isPaid={state.viewerIsPaid} />
      <AiReviewPendingRefresh auditId={state.id} enabled={state.aiReviewPending} />
    </AuditShell>
  )
}

export default ReportRoute
