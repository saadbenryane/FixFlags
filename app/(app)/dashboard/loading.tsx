import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <Container
      variant="report"
      className="space-y-6 px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-0"
      aria-busy="true"
      aria-label="Loading Products"
    >
      <div className="space-y-2">
        <Skeleton shimmer className="h-8 w-36 rounded-md" />
        <Skeleton shimmer className="h-4 w-80 max-w-full rounded-md" />
      </div>
      <Skeleton shimmer className="h-14 rounded-[var(--radius-control)]" />
      <Skeleton shimmer className="h-28 rounded-card" />
      <div className="space-y-3">
        <Skeleton shimmer className="h-5 w-28 rounded-md" />
        <div className="overflow-hidden rounded-card border border-border/45">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-border/45 px-4 py-4 last:border-0 sm:px-5"
            >
              <Skeleton shimmer className="h-[5.25rem] w-[7.5rem] shrink-0 rounded-[var(--radius-nested-md)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton shimmer className="h-5 w-40 max-w-full rounded-md" />
                <Skeleton shimmer className="h-4 w-56 max-w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}
