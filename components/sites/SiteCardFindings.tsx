'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { CircleAlert, Flag, Globe2, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { boardFindingTitle } from '@/lib/sites/board-card'
import { SITE_BOARD_COPY as C } from '@/lib/marketing/copy/terminology'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'

const PAGE_SIZE = 6
function pageLabel(url: string | null) {
  if (!url) return C.findingLocationUnknown
  try { const page = new URL(url); return page.pathname === '/' ? page.host : page.pathname }
  catch { return C.findingLocationUnknown }
}

/** A bounded priority queue, not an undifferentiated dump of every finding. */
export function SiteCardFindings({ siteId, flags, recommendations }: { siteId: string; flags: SiteFlagSeed[]; recommendations: SiteFlagSeed[] }) {
  const groups = [
    { id: 'fix-first', label: C.findingGroups.critical, Icon: CircleAlert, items: flags.filter((flag) => flag.priorityBand === 'fix_first') },
    { id: 'other', label: C.findingGroups.other, Icon: Flag, items: flags.filter((flag) => flag.priorityBand === 'other') },
  ].filter((group) => group.items.length > 0)
  const [selected, setSelected] = useState(groups[0]?.id)
  const [page, setPage] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const group = groups.find((item) => item.id === selected) ?? groups[0]
  if (!group && recommendations.length === 0) return null
  if (!group) return <RecommendationList recommendations={recommendations} />
  const pageCount = Math.ceil(group.items.length / PAGE_SIZE)
  const currentPage = Math.min(page, pageCount - 1)
  const items = group.items.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const Icon = group.Icon
  return <section className="space-y-4" aria-label={C.findingPriority}>
    {groups.length > 1 ? <div className="flex flex-wrap gap-2" role="tablist" aria-label="Flag priority">{groups.map((item, index) => <Button key={item.id} ref={(node) => { tabRefs.current[index] = node }} id={`flag-tab-${item.id}`} role="tab" tabIndex={group.id === item.id ? 0 : -1} aria-controls={`flag-panel-${item.id}`} aria-selected={group.id === item.id} size="sm" variant={group.id === item.id ? 'secondary' : 'ghost'} onClick={() => { setSelected(item.id); setPage(0) }} onKeyDown={(event) => {
      const last = groups.length - 1
      const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : null
      if (next === null) return
      event.preventDefault()
      setSelected(groups[next].id)
      setPage(0)
      tabRefs.current[next]?.focus()
    }}>
      <item.Icon className="mr-2 h-4 w-4" aria-hidden />{item.label}{' '}<span className="ml-2 text-muted-foreground">{item.items.length}</span>
    </Button>)}</div> : <h3 className="text-sm font-semibold">{group.label}</h3>}
    <div id={`flag-panel-${group.id}`} role="tabpanel" aria-labelledby={`flag-tab-${group.id}`}>
    <ul className="space-y-2">{items.map((flag) => <li key={flag.id}>
        <div className="flex min-h-20 flex-col gap-3 rounded-card border border-border p-3 sm:flex-row sm:items-center">
          <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-snug">{boardFindingTitle(flag.problem)}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate" title={flag.pageUrl ?? undefined}>{flag.affectedPageCount > 1 ? `${flag.affectedPageCount} affected pages` : pageLabel(flag.pageUrl)}</span></p>
          </div>
          <div className="flex shrink-0 gap-2"><SitePromptCopyButton compact siteId={siteId} flagId={flag.id} /><Button size="sm" variant="outline" asChild><Link href={`/sites/${siteId}/flags/${flag.id}`}>View Flag</Link></Button></div>
        </div>
    </li>)}</ul>
    </div>
    {pageCount > 1 ? <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, group.items.length)} of {group.items.length}</span><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="ghost" size="sm" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div> : null}
    <RecommendationList recommendations={recommendations} />
  </section>
}

export function RecommendationList({ recommendations }: { recommendations: SiteFlagSeed[] }) {
  if (recommendations.length === 0) return null
  return <section className="space-y-2 border-t border-border/60 pt-4" aria-labelledby="recommendations-heading">
    <h3 id="recommendations-heading" className="text-sm font-medium text-muted-foreground">Suggestions</h3>
    <ul className="space-y-2">{recommendations.map((flag) => <li key={flag.id} className="flex min-h-16 items-start gap-3 rounded-card border border-dashed border-border p-3"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden /><div className="min-w-0"><p className="text-sm font-medium">{boardFindingTitle(flag.problem)}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden />{pageLabel(flag.pageUrl)}</p></div></li>)}</ul>
  </section>
}
