import { Container } from '@/components/ui/container'

export default function AdminAnalyticsLoading() {
  return (
    <Container variant="wide" className="space-y-8 py-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-card bg-muted/60" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-card bg-muted/60" />
    </Container>
  )
}
