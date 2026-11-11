import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SitesOverviewSkeleton } from '@/components/sites/SitesOverviewGrid'

export default function DashboardLoading() {
  return (
    <Container
      variant="report"
      className="space-y-6 py-5 pb-24 sm:py-7"
      aria-busy="true"
      aria-label="Loading Sites"
    >
      <div aria-hidden="true">
        <Skeleton className="h-8 w-36 animate-none" />
      </div>
      <SitesOverviewSkeleton />
    </Container>
  )
}
