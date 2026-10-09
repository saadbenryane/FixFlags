'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRef } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SiteFlagTab } from '@/components/sites/SiteFlagsView'

export function SiteFlagTabs({ siteId, tab, openCount, resolvedCount }: { siteId: string; tab: SiteFlagTab; openCount: number; resolvedCount: number }) {
  const refs = useRef<Array<HTMLAnchorElement | null>>([])
  const tabs = [
    { id: 'open' as const, label: `Open (${openCount})`, href: `/sites/${siteId}/flags?tab=open` },
    { id: 'resolved' as const, label: `Resolved (${resolvedCount})`, href: `/sites/${siteId}/flags?tab=resolved` },
  ]
  return <div className="mb-6 flex gap-2 border-b border-border/40" role="tablist" aria-label="Flag lists">
    {tabs.map((item, index) => <Button key={item.id} role="tab" id={`${item.id}-flags-tab`} aria-controls={`${item.id}-flags-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} variant={tab === item.id ? 'brand' : 'ghost'} size="sm" asChild>
      <Link ref={(node) => { refs.current[index] = node }} href={item.href as Route} onKeyDown={(event) => {
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
          : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home' ? 0
          : event.key === 'End' ? tabs.length - 1
          : null
        if (next === null) return
        event.preventDefault()
        refs.current[next]?.focus()
      }}>
        {item.id === 'resolved' ? <History className="mr-1.5 h-4 w-4" aria-hidden /> : null}
        {item.label}
      </Link>
    </Button>)}
  </div>
}
