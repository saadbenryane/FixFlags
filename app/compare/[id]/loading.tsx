import { AuditShell } from '@/components/layout/audit-shell'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function CompareLoading() {
  return (
    <AuditShell>
      <Container variant="content" className="space-y-8 py-8">
        <Skeleton className="h-8 w-48 rounded-card" />
        <Skeleton className="h-12 w-full rounded-card" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
        <Skeleton className="h-48 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </Container>
    </AuditShell>
  )
}
