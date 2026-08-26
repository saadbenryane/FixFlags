'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SidebarNav } from '@/components/layout/sidebar'
import { Logo } from '@/components/brand/Logo'
import { useMe } from '@/hooks/useMe'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const GATED_HREFS = new Set(['/dashboard', '/settings', '/billing', '/admin'])

function useGatedNav() {
  const { user } = useMe()
  const gate = useReportAuthGate()

  return (href: string) => {
    if (user || !GATED_HREFS.has(href)) return false
    gate?.open({ reason: 'create-account' })
    return true
  }
}

export function ReportAppRail({
  showAdmin,
  className,
}: {
  showAdmin?: boolean
  className?: string
}) {
  const onGatedItem = useGatedNav()

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          'hidden w-16 shrink-0 flex-col border-r border-border/50 bg-background md:flex',
          className,
        )}
        aria-label="App"
      >
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <SidebarNav showAdmin={showAdmin} compact onGatedItem={onGatedItem} />
        </div>
      </aside>
    </TooltipProvider>
  )
}

export function ReportMobileNav({ showAdmin }: { showAdmin?: boolean }) {
  const onGatedItem = useGatedNav()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[260px] flex-col p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-border/40 px-4">
          <Logo variant="lockup" size="md" href="/" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav showAdmin={showAdmin} onGatedItem={onGatedItem} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
