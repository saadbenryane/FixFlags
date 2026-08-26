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
   * Backdrop intensity. Marketing uses its quiet page canvas; app/admin use a
   * static minimal grid. Anonymous work surfaces also pass `minimal`.
   */
  backdrop?: 'full' | 'minimal' | 'off'
  /** When false, skip header, sidebar, and footer. Prefer `immersive` for reports. */
  showChrome?: boolean
  /** Living-review editor: slim header, no sidebar, footer, or support bubble. */
  immersive?: boolean
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
  showChrome = true,
  immersive = false,
}: SiteShellProps) {
  const supportEnabled = immersive ? false : (showSupport ?? variant !== 'admin')
  const hasSidebar = !immersive && variant === 'app'
  const resolvedFooter = footer ?? (variant === 'marketing' ? 'default' : 'minimal')
  const resolvedBackdrop = backdrop ?? (variant === 'marketing' ? 'full' : 'minimal')

  const shell = (
    <div className="relative min-h-screen flex flex-col">
      {resolvedBackdrop !== 'off' && <GlobalMeshBackdrop fixed intensity={resolvedBackdrop} />}
      <div className="relative z-0 flex min-h-screen flex-col">
        {immersive ? (
          <>
            <Header
              variant="marketing"
              compact
              logoHref={logoHref}
              right={headerRight}
              showNavigation={false}
            />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              {children}
            </main>
          </>
        ) : !showChrome ? (
          <main id="main-content" className="flex-1" tabIndex={-1}>
            {children}
          </main>
        ) : hasSidebar ? (
          <div className="flex flex-1">
            <DesktopSidebar showAdmin={showAdmin} />
            <div className="flex min-w-0 flex-1 flex-col md:pl-16">
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
        {!immersive && showFooter && resolvedFooter === 'minimal' && <MinimalFooter />}
        {!immersive && showFooter && resolvedFooter === 'default' && <Footer />}
        {supportEnabled && <SupportWidgetLazy />}
      </div>
    </div>
  )

  if (!supportEnabled) {
    return shell
  }
  return (
    <SupportProvider>
      {shell}
    </SupportProvider>
  )
}
