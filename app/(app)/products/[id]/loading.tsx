import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProductLoading() {
  return (
    <Container
      variant="report"
      className="space-y-6 px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-0"
      aria-busy="true"
      aria-label="Loading Product"
    >
      <Skeleton shimmer className="h-11 w-28 rounded-[var(--radius-control)]" />
      <div className="space-y-1.5">
        <Skeleton shimmer className="h-8 w-56 max-w-full rounded-md" />
        <Skeleton shimmer className="h-4 w-40 max-w-full rounded-md" />
      </div>
      <Skeleton shimmer className="h-11 max-w-xl rounded-card" />
      <Skeleton shimmer className="h-56 rounded-card" />
      <Skeleton shimmer className="h-72 rounded-card" />
      <Skeleton shimmer className="h-48 rounded-card" />
    </Container>
  )
}
