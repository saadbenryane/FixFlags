import { SiteShell } from '@/components/layout/site-shell'
import { MarketingHeaderAuth } from '@/components/layout/MarketingHeaderAuth'

interface MarketingShellProps {
  children: React.ReactNode
  footer?: 'default' | 'minimal' | 'none'
  focused?: boolean
}

export function MarketingShell({ children, footer = 'default', focused = false }: MarketingShellProps) {
  return (
    <SiteShell
      variant="marketing"
      headerRight={focused ? null : <MarketingHeaderAuth />}
      showHeaderNavigation={!focused}
      showSupport={!focused}
      backdrop={focused ? 'minimal' : 'full'}
      showFooter={footer !== 'none'}
      footer={footer === 'minimal' ? 'minimal' : 'default'}
    >
      {children}
    </SiteShell>
  )
}
