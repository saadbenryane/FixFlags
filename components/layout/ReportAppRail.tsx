'use client'

import { MobileSidebar, SidebarNav } from '@/components/layout/sidebar'
import { useMe } from '@/hooks/useMe'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const GATED_HREFS = new Set(['/dashboard', '/settings', '/billing', '/admin'])

function useGatedNav() {
  const { user } = useMe()
  const gate = useReportAuthGate()

  return (href: string, trigger: HTMLElement) => {
    if (user || !GATED_HREFS.has(href)) return false
    gate?.open({ reason: 'create-account', nextPath: href, trigger })
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
          'hidden w-16 shrink-0 flex-col bg-background md:flex',
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
  return <MobileSidebar showAdmin={showAdmin} variant="report" onGatedItem={onGatedItem} />
}
