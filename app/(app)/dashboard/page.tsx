import { Suspense } from 'react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { ScoreSparkline } from '@/components/audit/ScoreSparkline'
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { getEffectiveScanLimit, getPendingCheckCount, isDevUnlimitedScans, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { canAccessPaidFeatures } from '@/lib/auth/entitlements'
import { isAtCheckLimit } from '@/lib/audit/usage'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { getDomainHistoryForUser } from '@/lib/audit/domain-history'
import { DomainHistoryPanel } from '@/components/dashboard/DomainHistoryPanel'
import { rubricLabel } from '@/lib/utils'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session!.user.id

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
      rechecks: {
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
    ? canAccessPaidFeatures({ id: userId, role: user.role, plan: user.plan })
    : false

  const totalCritical = completedAudits.reduce(
    (sum, a) => sum + a.rubrics.reduce((s, r) => s + r.flags.filter((f) => f.severity === 'CRITICAL').length, 0),
    0
  )
  const scores = completedAudits.map((a) => a.score).filter((s): s is number => s !== null)
  const bestScore = scores.length > 0 ? Math.max(...scores) : null
  const worstScore = scores.length > 0 ? Math.min(...scores) : null

  const [mcpAudits, webAudits, domainHistory] = await Promise.all([
    prisma.audit.count({ where: { userId, source: 'MCP' } }),
    prisma.audit.count({ where: { userId, source: { not: 'MCP' } } }),
    getDomainHistoryForUser(userId),
  ])

  return (
    <Container variant="report" className="py-8 space-y-8">
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

      <PageHeader title="Dashboard">
        <Button asChild>
          <Link href="/">
            <Plus className="h-4 w-4 mr-2" />
            New audit
          </Link>
        </Button>
        {user?.plan === 'FREE' && !isUnlimited && <UpgradeButton />}
      </PageHeader>

      {atAuditLimit && (
        <ContextualUpgradeCard moment="audit_limit_reached" isLoggedIn currentPlan="FREE" />
      )}

      <Surface variant="nested" className="sm:p-6">
        <SectionTitle className="mb-4">Audit a new URL</SectionTitle>
        <AuditInput />
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
          {domainHistory.length > 0 && <DomainHistoryPanel domains={domainHistory} />}

          {completedAudits.length > 0 && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span className="tabular-nums">{completedAudits.length} audit{completedAudits.length !== 1 ? 's' : ''}</span>
              {totalCritical > 0 && <span className="tabular-nums text-destructive">{totalCritical} critical flag{totalCritical !== 1 ? 's' : ''}</span>}
              {bestScore !== null && <span className="tabular-nums">Best: {bestScore}</span>}
              {worstScore !== null && <span className="tabular-nums">Worst: {worstScore}</span>}
            </div>
          )}

          <div className="space-y-3">
          <SectionTitle>Recent checks</SectionTitle>
          {audits.map((audit) => {
            const isCompleted = audit.status === 'COMPLETED'
            const rubrics = isCompleted
              ? computeRubricsFromRows(
                  audit.rubrics.map((r) => ({
                    name: r.name,
                    grade: r.grade,
                    score: r.score,
                    flags: r.flags.map((f) => ({ severity: f.severity })),
                  }))
                )
              : []
            const rubricMap = new Map(rubrics.map((r) => [r.name, r]))
            const statusLabel =
              audit.status === 'FAILED'
                ? 'Failed'
                : audit.status === 'COMPLETED'
                  ? null
                  : 'In progress'

            const trendScores = isCompleted
              ? [
                  audit.score,
                  ...audit.rechecks.map((r) => r.score),
                ].filter((s): s is number => s !== null)
              : []

            const criticalFlags = isCompleted
              ? audit.rubrics.flatMap((r) => r.flags.filter((f) => f.severity === 'CRITICAL')).length
              : 0
            const importantFlags = isCompleted
              ? audit.rubrics.flatMap((r) => r.flags.filter((f) => f.severity === 'IMPORTANT')).length
              : 0

            return (
              <Link key={audit.id} href={`/report/${audit.id}`} className="block group">
                <Card interactive>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {isCompleted && (
                        <div className="shrink-0">
                          <ScoreDisplay
                            score={audit.score}
                            grade={null}
                            variant="compact"
                            size="sm"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{audit.url}</span>
                          {statusLabel ? (
                            <Badge
                              variant={audit.status === 'FAILED' ? 'destructive' : 'secondary'}
                              size="sm"
                              className={audit.status !== 'FAILED' ? 'text-muted-foreground' : undefined}
                            >
                              {statusLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{new Date(audit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {criticalFlags > 0 && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              {criticalFlags} critical
                            </span>
                          )}
                          {importantFlags > 0 && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              {importantFlags} important
                            </span>
                          )}
                        </div>
                        {trendScores.length > 1 && (
                          <ScoreSparkline scores={trendScores} className="mt-1" />
                        )}
                      </div>
                      {isCompleted && (
                        <div className="flex gap-1 shrink-0">
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
                              Trend
                            </span>
                          )}
                        </div>
                      )}
                      <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
          </div>
        </div>
      )}

      <Accordion type="single" collapsible className="border-t border-border-subtle">
        <AccordionItem value="account" className="border-b-0">
          <AccordionTrigger>Account & projects</AccordionTrigger>
          <AccordionContent className="max-w-none text-foreground">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <UsageMeter
                  used={used}
                  limit={isUnlimited ? null : effectiveLimit}
                  pending={pending}
                  plan={user?.plan ?? 'FREE'}
                />
                <McpDashboardCard mcpAudits={mcpAudits} webAudits={webAudits} />
              </div>
              <VibecodingProfilePrompt />
              <ProjectsPanel plan={user?.plan ?? 'FREE'} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Container>
  )
}
