import { Header, type HeaderVariant } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { MinimalFooter } from '@/components/layout/minimal-footer'
import { ActiveAuditBanner } from '@/components/audit/ActiveAuditBanner'
import { SupportWidget } from '@/components/live-support/SupportWidget'

interface SiteShellProps {
  children: React.ReactNode
  variant?: HeaderVariant
  logoHref?: string
  headerRight?: React.ReactNode
  showFooter?: boolean
  footer?: 'default' | 'minimal'
  userEmail?: string | null
  showAdmin?: boolean
  adminInboxUnread?: number
}

export function SiteShell({
  children,
  variant = 'marketing',
  logoHref,
  headerRight,
  showFooter = true,
  footer = 'default',
  userEmail,
  showAdmin,
  adminInboxUnread = 0,
}: SiteShellProps) {
  const showSupport = variant !== 'admin'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        variant={variant}
        logoHref={logoHref}
        right={headerRight}
        userEmail={userEmail}
        showAdmin={showAdmin}
        adminInboxUnread={adminInboxUnread}
      />
      <ActiveAuditBanner />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      {showFooter && footer === 'minimal' && <MinimalFooter />}
      {showFooter && footer === 'default' && <Footer />}
      {showSupport && <SupportWidget />}
    </div>
  )
}
