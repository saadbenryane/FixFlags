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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <Skeleton shimmer className="h-8 w-36 rounded-md" />
          <Skeleton shimmer className="h-4 w-64 max-w-full rounded-md" />
        </div>
        <Skeleton shimmer className="h-6 w-24 rounded-full" />
      </div>

      {/* Release hub */}
      <div className="space-y-5 rounded-card bg-background/85 p-4 shadow-glass-deep glass-surface sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton shimmer className="h-11 w-11 shrink-0 rounded-[var(--radius-control)]" />
            <div className="min-w-0 space-y-2">
              <Skeleton shimmer className="h-5 w-44 max-w-full rounded-md" />
              <Skeleton shimmer className="h-3 w-32 rounded-md" />
            </div>
          </div>
          <Skeleton shimmer className="h-11 w-28 shrink-0 rounded-[var(--radius-control)]" />
        </div>
        <div className="space-y-2">
          <Skeleton shimmer className="h-7 w-48 rounded-md" />
          <Skeleton shimmer className="h-3 w-72 max-w-full rounded-md" />
        </div>
        <div className="grid sm:grid-cols-3">
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 p-4">
            <Skeleton shimmer className="h-3 w-20 rounded-md" />
            <Skeleton shimmer className="h-24 w-24 rounded-full" />
          </div>
          <div className="min-h-28 border-t border-border/35 p-4 sm:border-l sm:border-t-0">
            <Skeleton shimmer className="h-3 w-24 rounded-md" />
            <Skeleton shimmer className="mt-3 h-8 w-16 rounded-md" />
          </div>
          <div className="min-h-28 border-t border-border/35 p-4 sm:border-l sm:border-t-0">
            <Skeleton shimmer className="h-3 w-24 rounded-md" />
            <Skeleton shimmer className="mt-3 h-20 w-full rounded-md" />
          </div>
        </div>
        <div className="grid border-t border-border/35 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton
              key={index}
              shimmer
              className="m-1 h-14 rounded-[var(--radius-control)]"
            />
          ))}
        </div>
      </div>

      {/* Review a URL */}
      <div className="p-5 sm:p-6 glass-surface-elevated shadow-card rounded-card">
        <Skeleton shimmer className="mb-4 h-5 w-32 rounded-md" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton shimmer className="h-11 w-full flex-1 rounded-[var(--radius-control)]" />
          <Skeleton shimmer className="h-11 w-full rounded-[var(--radius-control)] sm:w-40" />
        </div>
      </div>

      {/* Usage + MCP */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton shimmer className="h-40 rounded-card" />
        <Skeleton shimmer className="h-40 rounded-card" />
      </div>

      {/* Recent checks */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <Skeleton shimmer className="h-5 w-32 rounded-md" />
          <Skeleton shimmer className="h-3 w-40 rounded-md" />
        </div>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} shimmer className="h-[76px] w-full rounded-card" />
        ))}
      </div>
    </Container>
  )
}
