import { Suspense } from 'react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn, gradeColor, areaLabel } from '@/lib/utils'
import { Plus, ExternalLink, ArrowLeftRight } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { UsageMeter } from '@/components/dashboard/UsageMeter'
import { UpgradeButton } from '@/components/dashboard/UpgradeButton'
import { ProjectsPanel } from '@/components/dashboard/ProjectsPanel'
import { ClaimAnonymousAudits } from '@/components/dashboard/ClaimAnonymousAudits'
import { DashboardCheckoutToast } from '@/components/dashboard/DashboardCheckoutToast'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { getEffectiveScanLimit, getPendingScanCount, isDevUnlimitedScans, isUnlimitedScanLimit } from '@/lib/auth/permissions'
import { AREA_ORDER } from '@/lib/audit/constants'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session!.user.id

  const user = await prisma.user.findUnique({ where: { id: userId } })

  const audits = await prisma.audit.findMany({
    where: { userId, status: 'COMPLETED', parentId: null },
    include: {
      areas: {
        select: { name: true, grade: true },
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
  const pending = user ? await getPendingScanCount(user.id) : 0
  const atAuditLimit =
    user?.plan === 'FREE' && !isUnlimited && effectiveLimit !== null && used >= effectiveLimit

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <Suspense>
        <DashboardCheckoutToast />
      </Suspense>
      <ClaimAnonymousAudits />
      <PageHeader title="Dashboard">
        <div className="flex items-center gap-2 shrink-0">
          {user?.plan === 'FREE' && !isUnlimited && <UpgradeButton />}
          <Button asChild>
            <Link href="/">
              <Plus className="h-4 w-4 mr-2" />
              New audit
            </Link>
          </Button>
        </div>
      </PageHeader>
      <div className="flex-1 max-w-xs space-y-1 -mt-4">
        <UsageMeter
          used={used}
          limit={isUnlimited ? null : effectiveLimit}
          pending={pending}
          plan={user?.plan ?? 'FREE'}
        />
      </div>

      {atAuditLimit && (
        <ContextualUpgradeCard moment="audit_limit_reached" isLoggedIn currentPlan="FREE" />
      )}

      <div className="rounded-xl border p-4 bg-muted/20">
        <p className="text-sm font-medium mb-3">Audit a new URL</p>
        <AuditInput />
      </div>

      <ProjectsPanel plan={user?.plan ?? 'FREE'} />

      {audits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No audits yet. Paste a URL above to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Recent audits</h2>
          {audits.map((audit) => {
            const orderedAreas = AREA_ORDER.map((n) =>
              audit.areas.find((a) => a.name === n)
            ).filter(Boolean)

            return (
              <Link key={audit.id} href={`/audit/${audit.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{audit.url}</div>
                        <div className="text-xs text-muted-foreground">
                          Score: {audit.score ?? '–'} · {new Date(audit.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {orderedAreas.map((area) => area && (
                          <div
                            key={area.name}
                            className={cn(
                              'text-xs font-bold px-1.5 py-0.5 rounded border',
                              gradeColor(area.grade)
                            )}
                            title={areaLabel(area.name)}
                          >
                            {area.grade}
                          </div>
                        ))}
                        {audit.rechecks.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
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
    </div>
  )
}
