import { SiteShell } from '@/components/layout/site-shell'
import { MarketingHeaderAuth } from '@/components/layout/MarketingHeaderAuth'
import { Container } from '@/components/ui/container'

interface AuditShellProps {
  children: React.ReactNode
  actions?: React.ReactNode
  session?: { user: { id: string; email?: string | null } } | null
  showAdmin?: boolean
  /** Viewport-filling report workspace with thin chrome and no site footer. */
  immersive?: boolean
}

export function AuditShell({
  children,
  actions,
  session,
  showAdmin = false,
  immersive = false,
}: AuditShellProps) {
  const variant = session ? 'app' : 'marketing'

  return (
    <SiteShell
      variant={variant}
      headerRight={variant === 'marketing' ? <MarketingHeaderAuth /> : undefined}
      showAdmin={showAdmin}
      showFooter={!immersive}
      showHeaderNavigation={!immersive}
      // The immersive editor owns its own chat column, and a floating bubble
      // would sit on top of the docked preview transport.
      showSupport={!immersive}
      backdrop="minimal"
    >
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
