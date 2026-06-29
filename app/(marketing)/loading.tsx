import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function MarketingLoading() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <Skeleton className="mx-auto h-10 w-72 rounded-card" />
      <Skeleton className="mx-auto mt-4 h-5 w-96 rounded-card" />
      <Skeleton className="mx-auto mt-8 h-12 w-full max-w-lg rounded-card" />
      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-card" />
        ))}
      </div>
    </Container>
  )
}
