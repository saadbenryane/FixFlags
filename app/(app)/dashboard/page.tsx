import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AuditInput } from '@/components/audit/AuditInput'
import { UsageMeter } from '@/components/dashboard/UsageMeter'
import { UpgradeButton } from '@/components/dashboard/UpgradeButton'
import { ProjectsPanel } from '@/components/dashboard/ProjectsPanel'
import { ClaimAnonymousAudits } from '@/components/dashboard/ClaimAnonymousAudits'
import { DashboardCheckoutToast } from '@/components/dashboard/DashboardCheckoutToast'
import { ExpertReviewSelectDialog } from '@/components/dashboard/ExpertReviewSelectDialog'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { FirstAuditPrompt } from '@/components/dashboard/FirstAuditPrompt'
import { McpDashboardCard } from '@/components/dashboard/McpDashboardCard'
import { RecentChecksList } from '@/components/dashboard/RecentChecksList'

import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { getEffectiveScanLimit, getPendingCheckCount, isDevUnlimitedScans, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { canAccessPaidFeatures } from '@/lib/auth/entitlements'
import { isAtCheckLimit } from '@/lib/audit/usage'

type DashboardSearchParams = {
  url?: string | string[]
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>
}) {
  const params = searchParams ? await searchParams : {}
  const initialAuditUrl = typeof params.url === 'string' ? params.url : ''
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const userId = session.user.id

  const user = await prisma.user.findUnique({ where: { id: userId } })

  const audits = await prisma.audit.findMany({
    where: { userId, parentId: null },
    include: {
      rubrics: {
        select: {
          name: true,
          grade: true,
          score: true,
          flags: { select: { severity: true } },
        },
      },
      monitoringAudits: {
        where: { status: 'COMPLETED' },
        select: { id: true, score: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const completedAudits = audits.filter((audit) => audit.status === 'COMPLETED')

  const used = user?.auditsUsed ?? 0
  const isUnlimited = isDevUnlimitedScans() || (user ? isUnlimitedScanLimit(getEffectiveScanLimit(user)) : false)
  const effectiveLimit = isUnlimited ? null : (user ? getEffectiveScanLimit(user) : 3)
  const pending = user ? await getPendingCheckCount(user.id) : 0
  const atAuditLimit =
    user?.plan === 'FREE' &&
    !isUnlimited &&
    effectiveLimit !== null &&
    isAtCheckLimit(used, pending, effectiveLimit)

  const canCompare = user
    ? canAccessPaidFeatures({ id: userId, role: user.role, plan: user.plan, subscriptionStatus: user.subscriptionStatus })
    : false

  const totalCritical = completedAudits.reduce(
    (sum, a) => sum + a.rubrics.reduce((s, r) => s + r.flags.filter((f) => f.severity === 'CRITICAL').length, 0),
    0
  )
  const scores = completedAudits.map((a) => a.score).filter((s): s is number => s !== null)
  const bestScore = scores.length > 0 ? Math.max(...scores) : null
  const worstScore = scores.length > 0 ? Math.min(...scores) : null

  const auditCounts = await prisma.audit.groupBy({
    by: ['source'],
    where: { userId },
    _count: true,
  })
  const mcpAudits = auditCounts.find((a) => a.source === 'MCP')?._count ?? 0
  const webAudits = auditCounts.find((a) => a.source !== 'MCP')?._count ?? 0

  return (
    <Container variant="report" className="py-6 space-y-6">
      <Suspense fallback={null}>
        <DashboardCheckoutToast />
        <ExpertReviewSelectDialog
          audits={completedAudits.map((audit) => ({
            id: audit.id,
            url: audit.url,
            score: audit.score,
            createdAt: audit.createdAt,
          }))}
        />
      </Suspense>
      <ClaimAnonymousAudits />

      <div className="flex items-center justify-between">
        <PageHeader title="Dashboard" />
        {user?.plan === 'FREE' && !isUnlimited && <UpgradeButton />}
      </div>

      {atAuditLimit && (
        <ContextualUpgradeCard moment="audit_limit_reached" isLoggedIn currentPlan="FREE" />
      )}

      {/* Usage + MCP summary row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <UsageMeter
          used={used}
          limit={isUnlimited ? null : effectiveLimit}
          pending={pending}
          plan={user?.plan ?? 'FREE'}
        />
        <McpDashboardCard mcpAudits={mcpAudits} webAudits={webAudits} />
      </div>

      {/* Audit input - main action */}
      <Surface variant="nested" className="sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Audit a URL</SectionTitle>
          {completedAudits.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedAudits.length} audit{completedAudits.length !== 1 ? 's' : ''}
              {totalCritical > 0 && (
                <span className="ml-2 text-destructive">{totalCritical} critical flag{totalCritical !== 1 ? 's' : ''}</span>
              )}
            </span>
          )}
        </div>
        <AuditInput initialUrl={initialAuditUrl} />
      </Surface>

      {audits.length === 0 ? (
        <>
          <EmptyState
            title="Run your first audit"
            description="See the Flags your AI editor missed, with fix prompts it can run."
          />
          <FirstAuditPrompt />
        </>
      ) : (
        <div className="space-y-6">
          <RecentChecksList
            audits={audits}
            canCompare={canCompare}
            bestScore={bestScore}
            worstScore={worstScore}
          />
        </div>
      )}

      <ProjectsPanel plan={user?.plan ?? 'FREE'} />
    </Container>
  )
}
