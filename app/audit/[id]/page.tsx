import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuditPageClient } from '@/components/audit/AuditPageClient'
import { AuditReport } from '@/components/audit/AuditReport'
import { AuditPageActions } from '@/components/audit/AuditPageActions'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'
import { prisma } from '@/lib/db'
import { getEntitlements, canAccessCompare } from '@/lib/auth/entitlements'
import { isAdminUser, getEffectiveScanLimit, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { resolveScreenshotUx } from '@/lib/audit/screenshot-types'
import type { ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { canAccessAudit } from '@/lib/audit/access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'

interface Props {
  params: Promise<{ id: string }>
}

function topIssueFromAudit(audit: {
  areas?: Array<{ findings?: Array<{ severity: string; problem: string }> }>
}): string | undefined {
  for (const area of audit.areas ?? []) {
    const finding = area.findings?.find(
      (f) => f.severity === 'HIGH' || f.severity === 'CRITICAL'
    )
    if (finding) return finding.problem
  }
  return undefined
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
      areas: {
        select: {
          findings: {
            select: { severity: true, problem: true },
            orderBy: { position: 'asc' },
            take: 5,
          },
        },
      },
    },
  })

  if (!audit || audit.status !== 'COMPLETED') {
    return { title: 'Audit report' }
  }

  const isShareableOg = audit.isPublic || audit.userId === null

  if (!isShareableOg) {
    return {
      title: 'Private audit report',
      description: 'Sign in to view this QualityOS audit report.',
      robots: { index: false, follow: false },
    }
  }

  if (!canAccessAudit(audit, session?.user) && !audit.isPublic && audit.userId) {
    return { title: 'Audit report' }
  }

  const hostname = (() => {
    try {
      return new URL(audit.url).hostname
    } catch {
      return audit.url
    }
  })()

  const topIssue = topIssueFromAudit(audit)
  const title = audit.score != null
    ? `${hostname} - ${audit.score}/100 · ${BRAND.name}`
    : `${hostname} audit · ${BRAND.name}`
  const description = topIssue
    ? `${topIssue}, Run your own audit at ${BRAND.name}.`
    : audit.verdict?.slice(0, 140) ??
      `Automated quality audit with fix prompts. Run your own audit at ${BRAND.name}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}/audit/${id}`,
      siteName: BRAND.name,
      images: [{ url: `/audit/${id}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/audit/${id}/opengraph-image`],
    },
  }
}

export default async function AuditPage({ params }: Props) {
  const { id } = await params
  const result = await getGatedAuditForRequest(id)

  if (result.kind === 'not_found') {
    notFound()
  }

  if (result.kind === 'forbidden') {
    return (
      <AuditShell session={null}>
        <Container className="py-24 text-center space-y-4">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-muted-foreground text-sm">You do not have access to this audit.</p>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </Container>
      </AuditShell>
    )
  }

  const { audit, isLoggedIn, session } = result
  const isOwner = Boolean(session?.user?.id && audit.userId === session.user.id)
  const isAnonymous = audit.userId === null
  const topIssue = topIssueFromAudit(audit)

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          plan: true,
          role: true,
          freeRecheckUsedAt: true,
          auditsUsed: true,
          auditsLimit: true,
        },
      })
    : null

  const atAuditLimit =
    user?.plan === 'FREE' &&
    !isUnlimitedScanLimit(getEffectiveScanLimit(user)) &&
    user.auditsUsed >= getEffectiveScanLimit(user)

  const entitlements = user
    ? getEntitlements({
        id: session!.user.id,
        role: user.role,
        plan: user.plan,
        freeRecheckUsedAt: user.freeRecheckUsedAt,
      })
    : null

  const latestRecheck =
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

  const compareRecheckAudit = audit.parentId
    ? { parentId: audit.parentId, userId: session?.user?.id ?? null }
    : latestRecheck
      ? { parentId: id, userId: session?.user?.id ?? null }
      : null

  const canAccessCompareView =
    user && compareRecheckAudit
      ? canAccessCompare(user, compareRecheckAudit)
      : false

  const viewerIsPaid = entitlements?.canAccessPaidFeatures ?? false

  if (audit.status === 'COMPLETED') {
    const screenshots = (audit.screenshots ?? []) as Array<{
      device: 'DESKTOP' | 'MOBILE'
      url: string
      width: number
      height: number
    }>
    const captureStatus = (audit as { screenshotCapture?: ScreenshotCaptureStatus }).screenshotCapture
    const { limited, partial } = resolveScreenshotUx(screenshots, captureStatus)

    return (
      <AuditShell
        session={session}
        showAdmin={user ? isAdminUser({ id: session!.user.id, role: user.role }) : false}
        actions={
          <AuditPageActions
            auditId={id}
            url={audit.url}
            score={audit.score}
            verdict={audit.verdict}
            topIssue={topIssue}
            areas={audit.areas.map((a) => ({
              name: a.name,
              grade: a.grade,
              score: a.score,
              findings: a.findings?.map((f) => ({
                severity: f.severity,
                problem: f.problem,
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
                  : latestRecheck?.id ?? null
                : null
            }
            plan={user?.plan ?? 'FREE'}
            projectId={audit.projectId}
            canUseFreeRecheck={entitlements?.canUseFreeRecheck ?? false}
          />
        }
      >
        <AuditReport
          audit={audit}
          auditId={id}
          viewerIsPaid={viewerIsPaid}
          viewerPlan={user?.plan ?? 'FREE'}
          isLoggedIn={isLoggedIn}
          isViewerOwner={isOwner}
          showRecheckHint={viewerIsPaid || (entitlements?.canUseFreeRecheck ?? false)}
          canUseFreeRecheck={entitlements?.canUseFreeRecheck ?? false}
          hasUsedFreeRecheck={entitlements?.hasUsedFreeRecheck ?? false}
          atAuditLimit={atAuditLimit}
          screenshotLimited={limited}
          screenshotPartial={partial}
        />
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
