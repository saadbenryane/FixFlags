'use client'

import { SidebarFooter, SidebarNav } from './sidebar'
import { Logo } from '@/components/brand/Logo'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMe } from '@/hooks/useMe'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { SiteChromeAuth } from '@/components/sites/SiteChromeAuth'

export function SiteAccountRail() {
  const { user } = useMe()
  const gate = useReportAuthGate()
  const onGatedItem = (href: string, trigger: HTMLElement) => {
    if (user || !gate || !['/dashboard', '/settings', '/billing'].includes(href)) return false
    gate.open({ reason: 'create-account', nextPath: href, trigger })
    return true
  }
  return <TooltipProvider delayDuration={150}>
    <aside className="fixed inset-y-0 left-0 z-navbar hidden w-[var(--site-account-rail-width)] flex-col bg-background md:flex" aria-label="App">
      <div className="flex h-16 shrink-0 items-center justify-center">
        <Logo variant="mark" size="md" href={user ? '/dashboard' : '/'} className="flex min-h-11 min-w-11 items-center justify-center" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3"><SidebarNav compact showAdmin={user?.isAdmin} onGatedItem={onGatedItem} /></div>
      <div className="flex flex-col items-center pb-3"><SidebarFooter compact />{!user ? <SiteChromeAuth iconOnly /> : null}</div>
    </aside>
  </TooltipProvider>
}
