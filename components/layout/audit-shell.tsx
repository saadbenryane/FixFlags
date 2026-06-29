import { SiteShell } from '@/components/layout/site-shell'
import { ClaimAnonymousAudits } from '@/components/dashboard/ClaimAnonymousAudits'
import { Container } from '@/components/ui/container'

interface AuditShellProps {
  children: React.ReactNode
  actions?: React.ReactNode
  session?: { user: { id: string; email?: string | null } } | null
  showAdmin?: boolean
}

export function AuditShell({ children, actions, session, showAdmin = false }: AuditShellProps) {
  return (
    <SiteShell
      variant={session ? 'app' : 'marketing'}
      userEmail={session?.user?.email}
      showAdmin={showAdmin}
    >
      {session && <ClaimAnonymousAudits />}
      {actions && (
        <div className="bg-muted/20">
          <Container variant="report" className="flex flex-wrap items-center justify-start gap-2 py-3 sm:justify-end">
            {actions}
          </Container>
        </div>
      )}
      {children}
    </SiteShell>
  )
}
