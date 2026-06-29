import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function AuthLoading() {
  return (
    <Container className="flex flex-1 items-center justify-center px-6 py-16 sm:py-20">
      <div className="w-full max-w-sm space-y-6">
        <Skeleton className="mx-auto h-8 w-32 rounded-card" />
        <Skeleton className="h-10 w-full rounded-card" />
        <Skeleton className="h-10 w-full rounded-card" />
        <Skeleton className="h-10 w-full rounded-card" />
      </div>
    </Container>
  )
}
