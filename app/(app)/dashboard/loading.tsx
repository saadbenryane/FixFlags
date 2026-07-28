import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <Container
      variant="report"
      className="space-y-5 px-4 py-5 pb-24 sm:space-y-6 sm:px-6 sm:py-7 sm:pb-24 lg:px-0"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>

      <Skeleton className="h-32 rounded-card" />

      <Skeleton className="h-36 rounded-card" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-card" />
        <Skeleton className="h-16 w-full rounded-card" />
        <Skeleton className="h-16 w-full rounded-card" />
      </div>
    </Container>
  )
}
