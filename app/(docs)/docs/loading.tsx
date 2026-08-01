import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function DocsLoading() {
  return (
    <Container
      variant="content"
      className="px-5 py-16 sm:px-8"
      aria-busy="true"
      aria-label="Loading documentation"
    >
      <Skeleton className="h-4 w-24 rounded-md" />
      <Skeleton className="mt-6 h-12 w-3/4 rounded-md" />
      <Skeleton className="mt-5 h-6 w-full rounded-md" />
      <div className="mt-16 space-y-4">
        <Skeleton className="h-8 w-48 rounded-card" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-5/6 rounded-md" />
      </div>
    </Container>
  )
}
