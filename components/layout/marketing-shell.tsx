import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { MarketingHeaderAuth } from '@/components/layout/MarketingHeaderAuth'

interface MarketingShellProps {
  children: React.ReactNode
}

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header right={<MarketingHeaderAuth />} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
