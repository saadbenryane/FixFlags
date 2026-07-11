import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AuditPageClient } from '@/components/audit/AuditPageClient'
import { AuditReport } from '@/components/audit/AuditReport'
import { AuditPageActions } from '@/components/audit/AuditPageActions'
import { AuditShell } from '@/components/layout/audit-shell'
import { ReportAccessDeniedStatus } from '@/components/ui/status-page'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'
import { prisma } from '@/lib/db'
import { getEntitlements, canAccessCompare, hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { isAdminUser, getEffectiveScanLimit, getPendingCheckCount, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { isAtCheckLimit } from '@/lib/audit/usage'
import { normalizeInternalScreenshotUrl, resolveScreenshotUx } from '@/lib/audit/screenshot-types'
import type { ScreenshotCaptureStatus, AuditScreenshot } from '@/lib/audit/screenshot-types'
import { McpFixNudge } from '@/components/audit/McpFixNudge'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { canAccessAudit } from '@/lib/audit/access'
import { isPublicMarketingSample } from '@/lib/audit/report-access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'

interface Props {
  params: Promise<{ id: string }>
}

function parseScreenshots(val: unknown): AuditScreenshot[] {
  if (!Array.isArray(val)) return []
  return val
    .filter((s): s is AuditScreenshot =>
      s !== null && typeof s === 'object' && 'device' in s && 'url' in s
    )
    .map((s) => ({
      ...s,
      url: typeof s.url === 'string' ? normalizeInternalScreenshotUrl(s.url) : '',
    }))
    .filter((s) => s.url.length > 0)
}

function parseCaptureStatus(audit: unknown): ScreenshotCaptureStatus | undefined {
  if (typeof audit !== 'object' || audit === null) return undefined
  const rec = audit as Record<string, unknown>
  const capture = rec.screenshotCapture
  if (typeof capture !== 'object' || capture === null) return undefined
  const c = capture as Record<string, unknown>
  return typeof c.desktop === 'string' && typeof c.mobile === 'string'
    ? (capture as ScreenshotCaptureStatus)
    : undefined
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

  const hostname = (() => {
    try {
      return new URL(audit.url).hostname
    } catch {
      return audit.url
    }
  })()

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

export default async function ReportPage({ params }: Props) {
  const { id } = await params
  const result = await getGatedAuditForRequest(id)

  if (result.kind === 'not_found') {
    notFound()
  }

  if (result.kind === 'forbidden') {
    return (
      <AuditShell session={null}>
        <ReportAccessDeniedStatus />
      </AuditShell>
    )
  }

  const { audit, isLoggedIn, session, showPrescription, showDeterministicFixes, aiReviewPending, triageDegraded, prescriptionFailed } = result
  const isOwner = Boolean(session?.user?.id && audit.userId === session.user.id)
  const isAnonymous = audit.userId === null
  const isMarketingSample = isPublicMarketingSample({
    userId: audit.userId,
    aiReviewAt: audit.aiReviewAt,
    isPublic: audit.isPublic,
  })
  const topIssue = topIssueFromFlags(audit.flags)

  const user = session?.user
    ? await prisma.user.findUnique({
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
    : null

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

  const latestMonitoring =
    session?.user && !audit.parentId
      ? await prisma.audit.findFirst({
          where: {
            parentId: id,
            userId: session.user.id,
            status: 'COMPLETED',
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
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
    const rubricRows = audit.rubricRows as Array<{
      id: string
      name: string
      grade: string
      score: number | null
      status: string | null
      summary: string
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
        lovablePrompt: string | null
        boltPrompt: string | null
        verificationRule: string | null
        pageUrl: string | null
        confidence: number | null
      }>
    }> | undefined ?? []

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
      lovablePrompt: f.lovablePrompt,
      boltPrompt: f.boltPrompt,
      verificationRule: f.verificationRule,
      pageUrl: f.pageUrl,
      confidence: f.confidence,
    }))

    const reportAudit = {
      ...audit,
      rubricRows,
      flags,
      shareStatus: audit.shareStatus,
    }

    const screenshots = parseScreenshots(audit.screenshots)
    const captureStatus = parseCaptureStatus(audit)
    const { limited, partial } = resolveScreenshotUx(screenshots, captureStatus)

    return (
      <AuditShell
        session={session}
        showAdmin={user && session ? isAdminUser({ id: session.user.id, role: user.role }) : false}
      >
        <AuditReport
          audit={reportAudit}
          auditId={id}
          viewerIsPaid={viewerIsPaid}
          viewerPlan={user?.plan ?? 'FREE'}
          isLoggedIn={isLoggedIn}
          isViewerOwner={isOwner}
          variant={isMarketingSample ? 'sample' : 'default'}
          showMonitoringHint={isLoggedIn && isOwner}
          atAuditLimit={atAuditLimit}
          screenshotLimited={limited}
          screenshotPartial={partial}
          showPrescription={showPrescription}
          showDeterministicFixes={showDeterministicFixes}
          aiReviewPending={aiReviewPending}
          triageDegraded={triageDegraded}
          prescriptionFailed={prescriptionFailed}
          failureCode={audit.failureCode ?? null}
          toolbarActions={
            <AuditPageActions
              auditId={id}
              url={audit.url}
              score={audit.score}
              verdict={audit.verdict}
              topIssue={topIssue}
              flags={flags}
              rubrics={rubricRows.map((r) => ({
                name: r.name,
                grade: r.grade,
                score: r.score,
                flags: r.flags.map((f) => ({
                  severity: f.severity,
                  problem: f.problem,
                  rubric: f.rubric,
                })),
              }))}
              isPaid={viewerIsPaid}
              isLoggedIn={isLoggedIn}
              isOwner={isOwner}
              isAnonymous={isAnonymous}
              isPublic={audit.isPublic}
              compareAuditId={
                canAccessCompareView
                  ? audit.parentId
                    ? id
                    : latestMonitoring?.id ?? null
                  : null
              }
              plan={user?.plan ?? 'FREE'}
              projectId={audit.projectId}
              canExportSummary={entitlements?.canExportSummary ?? false}
              canSharePublicly={entitlements?.canSharePublicly ?? false}
              showFixPrompts={showDeterministicFixes}
              toolbar
            />
          }
        />
        <McpFixNudge auditId={id} isPaid={viewerIsPaid} />
      </AuditShell>
    )
  }

  return (
    <AuditPageClient
      id={id}
      initialAudit={audit}
      pollStatus
      session={session}
    />
  )
}
