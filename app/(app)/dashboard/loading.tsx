import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SitesOverviewSkeleton } from '@/components/sites/SitesOverviewGrid'
import styles from '@/components/dashboard/WebsitesDashboard.module.css'

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
      <div className="space-y-6">
        <div className={styles.entry} aria-hidden="true">
          <Skeleton className="h-6 w-44 max-w-full animate-none" />
          <Skeleton className="mb-5 mt-2 h-5 w-full max-w-sm animate-none" />
          <Skeleton className="h-12 w-full animate-none rounded-control sm:h-[3.25rem]" />
        </div>
        <SitesOverviewSkeleton />
      </div>
    </Container>
  )
}
