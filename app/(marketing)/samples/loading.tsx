import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function SamplesLoading() {
  return (
    <Container className="space-y-8 py-12" aria-busy="true" aria-label="Loading sample Finish Plan">
      <div className="mx-auto space-y-3 text-center">
        <Skeleton className="mx-auto h-4 w-32" />
        <Skeleton className="mx-auto h-12 w-[min(36rem,90vw)]" />
        <Skeleton className="mx-auto h-5 w-[min(30rem,80vw)]" />
      </div>
      <Skeleton className="mx-auto aspect-[16/10] w-full max-w-5xl rounded-card" />
    </Container>
  )
}
