import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function CliAuthorizeLoading() {
  return (
    <Container className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-12">
      <Skeleton className="h-8 w-32 rounded-md" />
      <Skeleton className="h-11 w-full rounded-[var(--radius-control)]" />
      <Skeleton className="h-11 w-full rounded-[var(--radius-control)] mt-4" />
    </Container>
  )
}