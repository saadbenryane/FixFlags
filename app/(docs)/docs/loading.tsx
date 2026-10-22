import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { DOCS_UI_COPY } from '@/lib/marketing/copy/docs'

export default function DocsLoading() {
  return (
    <Container
      variant="content"
      className="px-5 py-16 sm:px-8"
      role="status"
      aria-busy="true"
      aria-labelledby="docs-loading-title"
    >
      <h1 id="docs-loading-title" className="sr-only">{DOCS_UI_COPY.loading}</h1>
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
