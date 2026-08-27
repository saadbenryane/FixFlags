import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Globe2 } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { DashboardCheckoutToast } from '@/components/dashboard/DashboardCheckoutToast'
import { ProductOverviewGrid } from '@/components/dashboard/ProductOverviewGrid'
import { UpgradeButton } from '@/components/dashboard/UpgradeButton'
import { UsageMeter } from '@/components/dashboard/UsageMeter'
import { PageHeader } from '@/components/layout/PageHeader'
import { Container } from '@/components/ui/container'
import { Surface } from '@/components/ui/surface'
import { SectionTitle } from '@/components/ui/typography'
import {
  getEffectiveScanLimit,
  getPendingCheckCount,
  getPlanDisplayLimit,
  isDevUnlimitedScans,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { isAtCheckLimit } from '@/lib/audit/usage'
import { planLabel } from '@/lib/billing/plans'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { loadProductOverview } from '@/lib/products/workspace'
import { Badge } from '@/components/ui/badge'

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
  const viewer = await getAppViewer()
  if (!viewer) redirect('/sign-in')
  const { user } = viewer

  const [products, pending] = await Promise.all([
    loadProductOverview(user.id),
    getPendingCheckCount(user.id),
  ])

  const used = user.auditsUsed
  const scansUnlimited =
    isDevUnlimitedScans() || isUnlimitedScanLimit(getEffectiveScanLimit(user))
  const displayLimit = getPlanDisplayLimit(user)
  const isEffectivelyFree =
    user.plan === 'FREE' || hasRevokedSubscriptionStatus(user.subscriptionStatus)
  const atAuditLimit =
    isEffectivelyFree &&
    !scansUnlimited &&
    displayLimit !== null &&
    isAtCheckLimit(used, pending, displayLimit)

  return (
    <Container
      variant="report"
      className="space-y-6 py-5 pb-24 sm:py-7"
    >
      <Suspense fallback={null}>
        <DashboardCheckoutToast />
      </Suspense>

      <PageHeader title={REPORT_COPY.workspace.dashboard.title}>
        {!isEffectivelyFree ? (
          <Badge
            variant="outline"
            className="border-success/30 bg-success/5 text-xs text-success"
          >
            {planLabel(user.plan)}
          </Badge>
        ) : displayLimit !== null ? (
          <UpgradeButton context="free_default" userEmail={user.email ?? undefined} />
        ) : null}
      </PageHeader>

      <UsageMeter
        variant="compact"
        used={used}
        limit={displayLimit}
        pending={pending}
        plan={user.plan}
      />

      <Surface
        variant="elevated"
        className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-center"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-brand-muted text-brand">
            <Globe2 className="h-5 w-5" aria-hidden />
          </span>
          <SectionTitle>{REPORT_COPY.workspace.dashboard.reviewUrlTitle}</SectionTitle>
        </div>
        <div className="min-w-0">
          <AuditInput
            initialUrl={initialAuditUrl}
            autoStart={Boolean(initialAuditUrl)}
            idSuffix="-dashboard"
            showLandingExtras={false}
          />
        </div>
      </Surface>

      <ProductOverviewGrid products={products} />

      {atAuditLimit ? (
        <ContextualUpgradeCard
          moment="audit_limit_reached"
          isLoggedIn
          currentPlan="FREE"
          userEmail={user.email ?? undefined}
        />
      ) : null}
    </Container>
  )
}
