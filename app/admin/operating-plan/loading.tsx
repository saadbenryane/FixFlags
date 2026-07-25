import { Container } from '@/components/ui/container'

export default function AdminOperatingPlanLoading() {
  return (
    <Container variant="wide" className="space-y-8 py-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-64 animate-pulse rounded-card bg-muted/60" />
      <div className="h-48 animate-pulse rounded-card bg-muted/60" />
    </Container>
  )
}
