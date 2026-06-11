import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface MarketingShellProps {
  children: React.ReactNode
  session?: { user: { id: string } } | null
}

export function MarketingShell({ children, session }: MarketingShellProps) {
  const headerRight = session ? (
    <Button variant="default" size="sm" asChild>
      <Link href="/dashboard">Dashboard</Link>
    </Button>
  ) : undefined

  return (
    <div className="min-h-screen flex flex-col">
      <Header right={headerRight} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
