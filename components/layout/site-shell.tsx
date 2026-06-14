import { Header, type HeaderVariant } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

interface SiteShellProps {
  children: React.ReactNode
  variant?: HeaderVariant
  logoHref?: string
  headerRight?: React.ReactNode
  showFooter?: boolean
  userEmail?: string | null
  showAdmin?: boolean
}

export function SiteShell({
  children,
  variant = 'marketing',
  logoHref,
  headerRight,
  showFooter = true,
  userEmail,
  showAdmin,
}: SiteShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header
        variant={variant}
        logoHref={logoHref}
        right={headerRight}
        userEmail={userEmail}
        showAdmin={showAdmin}
      />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  )
}
