import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportDetailsLoading() {
  return (
    <Container variant="report" className="space-y-6 py-8" aria-busy="true" aria-label="Opening report">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-24 w-full rounded-card" />
      <Skeleton className="h-[30rem] w-full rounded-card" />
    </Container>
  )
}
