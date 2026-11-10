import { AuditShell } from '@/components/layout/audit-shell'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

/** Earlier check links resolve to a Site board or a short notice; this only holds the frame. */
export default function ReportLoading() {
  return (
    <AuditShell session={null}>
      <Container variant="report" className="space-y-6 py-6 sm:py-8">
        <p role="status" className="text-sm text-muted-foreground">{SITE_ACTION_COPY.loading}</p>
        <div aria-hidden="true" className="space-y-6">
          <Skeleton className="h-7 w-48 max-w-full animate-none" />
          <Skeleton className="h-64 w-full animate-none rounded-card" />
        </div>
      </Container>
    </AuditShell>
  )
}
