import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

interface StackPageLoadingProps {
  container?: 'narrow' | 'report' | 'wide'
  heights?: readonly number[]
  label?: string
}

export function StackPageLoading({
  container = 'wide',
  heights = [256],
  label = 'Loading page',
}: StackPageLoadingProps) {
  return (
    <Container variant={container} className="space-y-8 py-8" aria-busy="true" aria-label={label}>
      <Skeleton className="h-8 w-48 rounded-md" />
      {heights.map((height, index) => (
        <Skeleton key={`${height}-${index}`} className="w-full rounded-card" style={{ height }} />
      ))}
    </Container>
  )
}

interface MetricsPageLoadingProps {
  container?: 'report' | 'wide'
  metrics?: number
}

export function MetricsPageLoading({ container = 'wide', metrics = 4 }: MetricsPageLoadingProps) {
  return (
    <Container variant={container} className="space-y-8 py-8" aria-busy="true" aria-label="Loading metrics">
      <Skeleton className="h-8 w-48 rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: metrics }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" />
    </Container>
  )
}

export function AdminColumnsLoading() {
  return (
    <Container variant="wide" className="space-y-8 py-8" aria-busy="true" aria-label="Loading inbox">
      <Skeleton className="h-8 w-48 rounded-md" />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_240px]">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </Container>
  )
}

export function AppPageLoading() {
  return (
    <Container variant="report" className="space-y-6 py-8" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-48 rounded-md" />
      <Skeleton className="h-24 w-full rounded-card" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-card" />
    </Container>
  )
}

export function MarketingPageLoading() {
  return (
    <Container
      className="flex flex-1 flex-col items-center justify-center py-24 text-center"
      aria-busy="true"
      aria-label="Loading page"
    >
      <Skeleton className="h-10 w-72 max-w-full rounded-md" />
      <Skeleton className="mt-4 h-5 w-96 max-w-full rounded-md" />
      <Skeleton className="mt-8 h-12 w-full max-w-lg rounded-[var(--radius-control)]" />
      <div className="mt-16 grid w-full gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-card" />
        ))}
      </div>
    </Container>
  )
}

export function AuthPageLoading() {
  return (
    <Container
      className="flex flex-1 items-center justify-center px-6 py-16 sm:py-20"
      aria-busy="true"
      aria-label="Loading account page"
    >
      <div className="w-full max-w-sm space-y-6">
        <Skeleton className="mx-auto h-8 w-32 rounded-md" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-[var(--radius-control)]" />
        ))}
      </div>
    </Container>
  )
}
