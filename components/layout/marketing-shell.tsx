import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/auth/SignOutButton'

interface MarketingShellProps {
  children: React.ReactNode
  session?: { user: { email?: string | null } } | null
}

export function MarketingShell({ children, session }: MarketingShellProps) {
  const headerRight = session ? (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <SignOutButton />
    </div>
  ) : undefined

  return (
    <div className="min-h-screen flex flex-col">
      <Header right={headerRight} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
