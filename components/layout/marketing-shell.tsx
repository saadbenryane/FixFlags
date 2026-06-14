import { SiteShell } from '@/components/layout/site-shell'
import { MarketingHeaderAuth } from '@/components/layout/MarketingHeaderAuth'

interface MarketingShellProps {
  children: React.ReactNode
  footer?: 'default' | 'minimal' | 'none'
}

export function MarketingShell({ children, footer = 'default' }: MarketingShellProps) {
  return (
    <SiteShell
      variant="marketing"
      headerRight={<MarketingHeaderAuth />}
      showFooter={footer !== 'none'}
      footer={footer === 'minimal' ? 'minimal' : 'default'}
    >
      {children}
    </SiteShell>
  )
}
