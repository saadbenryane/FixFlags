'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { Check, ChevronsUpDown, LayoutGrid } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SiteCaptureThumb } from '@/components/sites/SiteCaptureThumb'
import { APP_NAV_COPY } from '@/lib/marketing/copy/navigation'
import type { SiteSummary } from '@/lib/sites/application/list-sites'

const C = APP_NAV_COPY.switcher

/**
 * The top of the app panel: which website you are looking at, and the way to every other one.
 * The list loads when the menu first opens, so the panel costs nothing until it is used.
 */
export function SiteSwitcher({ current }: { current?: { id: string; host: string } | null }) {
  const [sites, setSites] = useState<SiteSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  async function load() {
    if (sites) return
    try {
      const response = await fetch('/api/sites', { cache: 'no-store' })
      if (!response.ok) throw new Error('load failed')
      setSites(await response.json() as SiteSummary[]); setFailed(false)
    } catch { setFailed(true) }
  }
  return <DropdownMenu onOpenChange={open => { if (open) void load() }}>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label={`${C.label}: ${current?.host ?? C.all}`}
        className="flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-control)] bg-muted/50 px-3 text-left text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-background text-muted-foreground shadow-[0_1px_2px_hsl(30_10%_20%/.08)]"><LayoutGrid className="h-4 w-4" aria-hidden /></span>
        <span className="min-w-0 flex-1 truncate">{current?.host ?? C.all}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="bottom" align="start" className="w-64">
      <DropdownMenuItem asChild>
        <Link href="/dashboard" className="mb-1 gap-2"><LayoutGrid className="h-4 w-4" aria-hidden />{C.all}{!current ? <Check className="ml-auto h-4 w-4" aria-hidden /> : null}</Link>
      </DropdownMenuItem>
      {failed ? <DropdownMenuLabel className="font-normal text-muted-foreground">{C.failed}</DropdownMenuLabel>
        : !sites ? <DropdownMenuLabel className="font-normal text-muted-foreground">{C.loading}</DropdownMenuLabel>
        : sites.map(site => <DropdownMenuItem key={site.id} asChild>
          <Link href={`/sites/${site.id}` as Route} className="gap-2">
            <SiteCaptureThumb className="h-6 w-8 shrink-0 overflow-hidden rounded" src={site.presentation.identity.preview?.url ?? null} />
            <span className="min-w-0 flex-1 truncate">{site.hostname || site.name}</span>
            {current?.id === site.id ? <Check className="h-4 w-4" aria-hidden /> : null}
          </Link>
        </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}
