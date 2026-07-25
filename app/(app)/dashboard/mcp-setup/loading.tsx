import { Container } from '@/components/ui/container'

export default function McpSetupLoading() {
  return (
    <Container variant="report" className="space-y-6 py-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-48 animate-pulse rounded-card bg-muted/60" />
      <div className="h-32 animate-pulse rounded-card bg-muted/60" />
    </Container>
  )
}
