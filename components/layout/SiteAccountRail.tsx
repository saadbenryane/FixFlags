'use client'

import { SidebarFooter, SidebarNav } from './sidebar'
import { Logo } from '@/components/brand/Logo'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMe } from '@/hooks/useMe'

export function SiteAccountRail() {
  const { user } = useMe()
  if (!user) return null
  return <TooltipProvider delayDuration={150}>
    <aside className="fixed inset-y-0 left-0 z-navbar hidden w-16 flex-col border-r border-border/60 bg-background md:flex" aria-label="App">
      <div className="flex h-16 shrink-0 items-center justify-center">
        <Logo variant="mark" size="md" href="/dashboard" className="flex min-h-11 min-w-11 items-center justify-center" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3"><SidebarNav compact showAdmin={user.isAdmin} /></div>
      <SidebarFooter compact />
    </aside>
  </TooltipProvider>
}
