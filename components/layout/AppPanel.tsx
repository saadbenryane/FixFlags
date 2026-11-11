'use client'

import type { ReactNode } from 'react'
import { SidebarNav } from './sidebar'
import { AvatarMenu } from './AvatarMenu'
import { SiteSwitcher } from './SiteSwitcher'
import { Logo } from '@/components/brand/Logo'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMe } from '@/hooks/useMe'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { SiteChromeAuth } from '@/components/sites/SiteChromeAuth'

/**
 * The app panel: which website you are on and its sections, with the account and everything about it
 * (billing, keys, docs, help, settings) folded into one menu at the foot.
 */
export function AppPanel({ current, navigation }: {
  /** The website being viewed; none means all websites. */
  current?: { id: string; host: string } | null
  /** That website's sections. Without a website, the panel offers the list of websites. */
  navigation?: ReactNode
}) {
  const { user } = useMe()
  const gate = useReportAuthGate()
  const onGatedItem = (href: string, trigger: HTMLElement) => {
    if (user || !gate || !['/dashboard', '/settings', '/billing'].includes(href)) return false
    gate.open({ reason: 'create-account', nextPath: href, trigger })
    return true
  }
  return <TooltipProvider delayDuration={150}>
    <aside className="fixed inset-y-0 left-0 z-navbar hidden w-[var(--app-panel-width)] flex-col bg-background md:flex" aria-label="App">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo variant="lockup" size="sm" href={user ? '/dashboard' : '/'} className="flex min-h-11 items-center" />
      </div>
      {user ? <div className="px-3"><SiteSwitcher current={current} /></div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{navigation ?? <SidebarNav primaryOnly onGatedItem={onGatedItem} />}</div>
      <div className="px-3 pb-3">{user ? <AvatarMenu user={user} variant="panel" side="top" align="start" /> : <SiteChromeAuth />}</div>
    </aside>
  </TooltipProvider>
}
