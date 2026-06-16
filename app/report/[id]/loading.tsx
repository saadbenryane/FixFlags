import { AuditShell } from '@/components/layout/audit-shell'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportLoading() {
  return (
    <AuditShell>
      <Container variant="content" className="space-y-8 py-8">
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-12 w-full rounded-card" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-card" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </Container>
    </AuditShell>
  )
}
