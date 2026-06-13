import { SiteShell } from '@/components/layout/site-shell'
import { MarketingHeaderAuth } from '@/components/layout/MarketingHeaderAuth'

interface MarketingShellProps {
  children: React.ReactNode
}

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <SiteShell variant="marketing" headerRight={<MarketingHeaderAuth />}>
      {children}
    </SiteShell>
  )
}
