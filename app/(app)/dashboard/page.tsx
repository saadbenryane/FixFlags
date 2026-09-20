import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { DashboardCheckoutToast } from '@/components/dashboard/DashboardCheckoutToast'
import { SitesOverviewGrid } from '@/components/sites/SitesOverviewGrid'
import { PageHeader } from '@/components/layout/PageHeader'
import { Container } from '@/components/ui/container'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'

export default async function DashboardPage() {
  const viewer = await getAppViewer()
  if (!viewer) redirect('/sign-in')
  const sites = await loadSiteSummaries(viewer.user.id)

  return (
    <Container
      variant="report"
      className="space-y-6 py-5 pb-24 sm:py-7"
    >
      <Suspense fallback={null}>
        <DashboardCheckoutToast />
      </Suspense>

      <PageHeader title="Your Sites" />
      <p className="max-w-2xl text-sm text-muted-foreground">
        Each Site keeps its Cards, Journeys, Flags, fixes, verification history, and Watch state together.
      </p>
      <SitesOverviewGrid sites={sites} />
    </Container>
  )
}
