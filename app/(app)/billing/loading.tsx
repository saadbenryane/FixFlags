import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function BillingLoading() {
  return (
    <Container variant="narrow" className="space-y-8 py-8">
      <Skeleton className="h-8 w-36 rounded-card" />
      <Skeleton className="h-48 w-full rounded-card" />
      <Skeleton className="h-64 w-full rounded-card" />
    </Container>
  )
}
