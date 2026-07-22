import { Header, type HeaderVariant } from '@/components/layout/header'
import { DesktopSidebar, MobileSidebar } from '@/components/layout/sidebar'
import { Logo } from '@/components/brand/Logo'
import { Footer } from '@/components/layout/footer'
import { MinimalFooter } from '@/components/layout/minimal-footer'
import { ActiveAuditBanner } from '@/components/audit/ActiveAuditBanner'
import { SupportWidgetLazy } from '@/components/live-support/SupportWidgetLazy'
import { SupportProvider } from '@/components/live-support/SupportProvider'
import { GlobalMeshBackdrop } from '@/components/marketing/landing/GlobalMeshBackdrop'

interface SiteShellProps {
  children: React.ReactNode
  variant?: HeaderVariant
  logoHref?: string
  headerRight?: React.ReactNode
  showFooter?: boolean
  footer?: 'default' | 'minimal'
  showAdmin?: boolean
  adminInboxUnread?: number
  showHeaderNavigation?: boolean
  showSupport?: boolean
  /**
   * Backdrop intensity. Defaults from variant (marketing gets the animated
   * 'full' mesh, app/admin the static 'minimal' grid). Work surfaces that
   * render with the marketing header (e.g. anonymous report views) must pass
   * 'minimal': ambient motion is a marketing-landing signature only.
   */
  backdrop?: 'full' | 'minimal' | 'off'
}

export function SiteShell({
  children,
  variant = 'marketing',
  logoHref,
  headerRight,
  showFooter = true,
  footer,
  showAdmin,
  adminInboxUnread = 0,
  showHeaderNavigation = true,
  showSupport,
  backdrop,
}: SiteShellProps) {
  const supportEnabled = showSupport ?? variant !== 'admin'
  const hasSidebar = variant === 'app'
  const resolvedFooter = footer ?? (variant === 'marketing' ? 'default' : 'minimal')
  const resolvedBackdrop = backdrop ?? (variant === 'marketing' ? 'full' : 'minimal')

  const shell = (
    <div className="relative min-h-screen flex flex-col">
      {resolvedBackdrop !== 'off' && <GlobalMeshBackdrop fixed intensity={resolvedBackdrop} />}
      <div className="relative z-0 flex min-h-screen flex-col">
        {hasSidebar ? (
          <div className="flex flex-1">
            <DesktopSidebar showAdmin={showAdmin} />
            <div className="flex flex-1 flex-col min-w-0 md:pl-60">
              <div className="sticky top-0 z-navbar flex h-14 items-center gap-3 border-b border-border/40 px-4 glass-nav md:hidden">
                <MobileSidebar showAdmin={showAdmin} />
                <Logo variant="wordmark" size="sm" href="/dashboard" />
              </div>
              <ActiveAuditBanner />
              <main id="main-content" className="flex-1" tabIndex={-1}>
                {children}
              </main>
            </div>
          </div>
        ) : (
          <>
            <Header
              variant={variant}
              logoHref={logoHref}
              right={headerRight}
              adminInboxUnread={adminInboxUnread}
              showNavigation={showHeaderNavigation}
            />
            <ActiveAuditBanner />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              {children}
            </main>
          </>
        )}
        {showFooter && resolvedFooter === 'minimal' && <MinimalFooter />}
        {showFooter && resolvedFooter === 'default' && <Footer />}
        {supportEnabled && <SupportWidgetLazy />}
      </div>
    </div>
  )

  if (!supportEnabled) return shell
  return <SupportProvider>{shell}</SupportProvider>
}
