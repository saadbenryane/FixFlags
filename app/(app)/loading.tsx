import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function AppLoading() {
  return (
    <Container variant="report" className="space-y-6 py-8">
      <Skeleton className="h-8 w-48 rounded-card" />
      <Skeleton className="h-24 w-full rounded-card" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-card" />
    </Container>
  )
}
