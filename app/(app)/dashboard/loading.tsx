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
      <div className="space-y-3">
        <Skeleton shimmer className="h-5 w-28 rounded-md" />
        <div className="overflow-hidden rounded-card border border-border/45">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton
              key={index}
              shimmer
              className="h-28 rounded-none border-b border-border/45 last:border-0"
            />
          ))}
        </div>
      </div>
      <Skeleton shimmer className="h-40 rounded-card" />
      <Skeleton shimmer className="h-44 rounded-card" />
    </Container>
  )
}
