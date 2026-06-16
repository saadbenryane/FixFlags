import { Suspense } from 'react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { Plus, ExternalLink, ArrowLeftRight } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { UsageMeter } from '@/components/dashboard/UsageMeter'
import { UpgradeButton } from '@/components/dashboard/UpgradeButton'
import { ProjectsPanel } from '@/components/dashboard/ProjectsPanel'
import { ClaimAnonymousAudits } from '@/components/dashboard/ClaimAnonymousAudits'
import { DashboardCheckoutToast } from '@/components/dashboard/DashboardCheckoutToast'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { Container } from '@/components/ui/container'
import { getEffectiveScanLimit, getPendingCheckCount, isDevUnlimitedScans, isUnlimitedScanLimit } from '@/lib/auth/permissions'
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
    user?.plan === 'FREE' && !isUnlimited && effectiveLimit !== null && used >= effectiveLimit

  return (
    <Container variant="report" className="py-8 space-y-8">
      <Suspense>
        <DashboardCheckoutToast />
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
        <div className="max-w-xs">
          <UsageMeter
            used={used}
            limit={isUnlimited ? null : effectiveLimit}
            pending={pending}
            plan={user?.plan ?? 'FREE'}
          />
        </div>
      </div>

      {atAuditLimit && (
        <ContextualUpgradeCard moment="audit_limit_reached" isLoggedIn currentPlan="FREE" />
      )}

      <Surface variant="nested" className="sm:p-6">
        <SectionTitle className="mb-4">Audit a new URL</SectionTitle>
        <AuditInput />
      </Surface>

      <ProjectsPanel plan={user?.plan ?? 'FREE'} />

      {audits.length === 0 ? (
        <EmptyState
          title="No audits yet"
          description="Paste a URL above to run your first check and get fix prompts."
        />
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
                                  r.status === 'PASS'
                                    ? '✓'
                                    : r.status === 'BLOCKED'
                                      ? '✗'
                                      : '!'
                                }
                              />
                            </span>
                          )
                        })}
                        {audit.rechecks.length > 0 && (
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
