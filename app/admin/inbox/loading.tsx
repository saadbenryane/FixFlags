import { Container } from '@/components/ui/container'

export default function AdminInboxLoading() {
  return (
    <Container variant="wide" className="space-y-8 py-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_240px]">
        <div className="h-64 animate-pulse rounded-card bg-muted/60" />
        <div className="h-96 animate-pulse rounded-card bg-muted/60" />
        <div className="h-64 animate-pulse rounded-card bg-muted/60" />
      </div>
    </Container>
  )
}
