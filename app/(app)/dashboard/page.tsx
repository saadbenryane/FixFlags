import { Suspense } from 'react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { Plus, ExternalLink, ArrowLeftRight, Check, X, AlertTriangle } from 'lucide-react'
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
import { VibecodingProfilePrompt } from '@/components/dashboard/VibecodingProfilePrompt'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { getEffectiveScanLimit, getPendingCheckCount, isDevUnlimitedScans, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { canAccessPaidFeatures } from '@/lib/auth/entitlements'
import { isAtCheckLimit } from '@/lib/audit/usage'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { rubricLabel } from '@/lib/utils'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session!.user.id

  const user = await prisma.user.findUnique({ where: { id: userId } })

  const audits = await prisma.audit.findMany({
    where: { userId, status: 'COMPLETED', parentId: null },
    include: {
      rubrics: {
        select: {
          name: true,
          grade: true,
          score: true,
          flags: { select: { severity: true } },
        },
      },
      rechecks: {
        where: { status: 'COMPLETED' },
        select: { id: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

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
    ? canAccessPaidFeatures({ id: userId, role: user.role, plan: user.plan })
    : false

  const [mcpAudits, webAudits] = await Promise.all([
    prisma.audit.count({ where: { userId, source: 'MCP' } }),
    prisma.audit.count({ where: { userId, source: { not: 'MCP' } } }),
  ])

  return (
    <Container variant="report" className="py-8 space-y-8">
      <Suspense>
        <DashboardCheckoutToast />
        <ExpertReviewSelectDialog
          audits={audits.map((audit) => ({
            id: audit.id,
            url: audit.url,
            score: audit.score,
            createdAt: audit.createdAt,
          }))}
        />
      </Suspense>
      <ClaimAnonymousAudits />
      <div className="space-y-6">
        <PageHeader title="Dashboard">
          <Button asChild>
            <Link href="/">
              <Plus className="h-4 w-4 mr-2" />
              New audit
            </Link>
          </Button>
          {user?.plan === 'FREE' && !isUnlimited && <UpgradeButton />}
        </PageHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageMeter
            used={used}
            limit={isUnlimited ? null : effectiveLimit}
            pending={pending}
            plan={user?.plan ?? 'FREE'}
          />
          <McpDashboardCard mcpAudits={mcpAudits} webAudits={webAudits} />
        </div>
      </div>

      {atAuditLimit && (
        <ContextualUpgradeCard moment="audit_limit_reached" isLoggedIn currentPlan="FREE" />
      )}

      <VibecodingProfilePrompt />

      <Surface variant="nested" className="sm:p-6">
        <SectionTitle className="mb-4">Audit a new URL</SectionTitle>
        <AuditInput />
      </Surface>

      <ProjectsPanel plan={user?.plan ?? 'FREE'} />

      {audits.length === 0 ? (
        <>
          <EmptyState
            title="No audits yet"
            description="Paste a URL above to run your first check and get fix prompts."
          />
          <FirstAuditPrompt />
        </>
      ) : (
        <div className="space-y-3">
          <SectionTitle>Recent audits</SectionTitle>
          {audits.map((audit) => {
            const rubrics = computeRubricsFromRows(
              audit.rubrics.map((r) => ({
                name: r.name,
                grade: r.grade,
                score: r.score,
                flags: r.flags.map((f) => ({ severity: f.severity })),
              }))
            )
            const rubricMap = new Map(rubrics.map((r) => [r.name, r]))

            return (
              <Link key={audit.id} href={`/report/${audit.id}`} className="block">
                <Card interactive>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{audit.url}</div>
                        <div className="text-xs text-muted-foreground">
                          Score: {audit.score ?? '–'} · {new Date(audit.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {RUBRIC_ORDER.map((name) => {
                          const r = rubricMap.get(name)
                          if (!r) return null
                          return (
                            <span key={name} title={rubricLabel(name)}>
                              <RubricStatusBadge
                                status={r.status}
                                size="sm"
                                label={
                                  r.status === 'PASS' ? (
                                    <Check className="h-3 w-3" aria-hidden />
                                  ) : r.status === 'BLOCKED' ? (
                                    <X className="h-3 w-3" aria-hidden />
                                  ) : (
                                    <AlertTriangle className="h-3 w-3" aria-hidden />
                                  )
                                }
                              />
                            </span>
                          )
                        })}
                        {audit.rechecks.length > 0 && canCompare && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
                            <ArrowLeftRight className="h-3 w-3" />
                            Compare
                          </span>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </Container>
  )
}
