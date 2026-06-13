import { AuditShell } from '@/components/layout/audit-shell'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function AuditLoading() {
  return (
    <AuditShell>
      <Container className="max-w-3xl py-8 space-y-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </Container>
    </AuditShell>
  )
}
