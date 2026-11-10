'use client'

import { hasRepairGuidance } from '@/lib/improvements/repair-guidance'

import { useId, useLayoutEffect, useRef, useState } from 'react'
import { CircleAlert, Flag, Globe2, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteFlagTarget } from './SiteFlagTarget'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { boardFindingTitle } from '@/lib/sites/board-card'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY as C } from '@/lib/marketing/copy/terminology'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { SiteFlagSelection, SiteFlagSelectionCheckbox } from './SiteFlagSelection'
import { SITE_DASHBOARD_COPY as D } from '@/lib/marketing/copy/site-dashboard'
import styles from './SiteCardFindings.module.css'

const PAGE_SIZE = 6
function pageLabel(url: string | null) {
  if (!url) return C.findingLocationUnknown
  try { const page = new URL(url); return page.pathname === '/' ? page.host : page.pathname }
  catch { return C.findingLocationUnknown }
}

/** A bounded priority queue, not an undifferentiated dump of every finding. */
export function SiteCardFindings(props: Parameters<typeof SiteCardFindingsContent>[0]) {
  return <SiteFlagSelection siteId={props.siteId} flags={props.flags} availability={props.copyAvailability ?? 'available'}><SiteCardFindingsContent {...props} /></SiteFlagSelection>
}

function SiteCardFindingsContent({ siteId, flags, recommendations, copyAvailability = 'available', showPage = true, onOpenFlag }: { onOpenFlag?: (id: string, trigger?: HTMLElement) => void; showPage?: boolean; copyAvailability?: SiteActionAvailability; siteId: string; flags: SiteFlagSeed[]; recommendations: SiteFlagSeed[] }) {
  const id = useId()
  const groups = [
    { id: 'fix-first', label: C.findingGroups.critical, Icon: CircleAlert, items: flags.filter((flag) => flag.priorityBand === 'fix_first') },
    { id: 'other', label: C.findingGroups.other, Icon: Flag, items: flags.filter((flag) => flag.priorityBand === 'other') },
  ].filter((group) => group.items.length > 0)
  const [navigation, setNavigation] = useState({ group: groups[0]?.id, page: 0 })
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const list = useRef<HTMLUListElement>(null)
  const focusPage = useRef(false)
  const readingPosition = useRef<{ element: HTMLElement; index: number; group: string; page: number } | null>(null)
  const group = groups.find((item) => item.id === navigation.group) ?? groups[0]
  const pageCount = group ? Math.ceil(group.items.length / PAGE_SIZE) : 0
  const currentPage = Math.min(navigation.group === group?.id ? navigation.page : 0, Math.max(0, pageCount - 1))
  // Retire vanished groups and pages, so recurrence cannot restore an old choice.
  if (navigation.group !== group?.id || navigation.page !== currentPage) setNavigation({ group: group?.id, page: currentPage })
  useLayoutEffect(() => {
    if (focusPage.current) {
      focusPage.current = false
      list.current?.querySelector('h3')?.focus()
      return
    }
    const previous = readingPosition.current
    if (!previous) return
    if (previous.element.isConnected) {
      const index = Array.from(list.current?.children ?? []).findIndex(row => row.contains(previous.element))
      if (index >= 0 && group) readingPosition.current = { ...previous, index, group: group.id, page: currentPage }
      return
    }
    readingPosition.current = null
    // Recover only focus lost with a removed finding, never focus moved elsewhere.
    if (document.activeElement !== document.body || !list.current) return
    const index = previous.group === group?.id && previous.page === currentPage ? previous.index : 0
    const row = list.current.children[Math.min(index, list.current.children.length - 1)]
    row?.querySelector('h3')?.focus()
  })
  if (!group && recommendations.length === 0) return null
  if (!group) return <RecommendationList recommendations={recommendations} />
  const items = group.items.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const Icon = group.Icon
  return <section className="space-y-4" aria-label={C.findingPriority}>
    {groups.length > 1 ? <div className="flex flex-wrap gap-2" role="tablist" aria-label={D.flagPriority}>{groups.map((item, index) => <Button key={item.id} ref={(node) => { tabRefs.current[index] = node }} id={`${id}-flag-tab-${item.id}`} role="tab" tabIndex={group.id === item.id ? 0 : -1} aria-controls={`${id}-flag-panel-${item.id}`} aria-selected={group.id === item.id} size="sm" variant={group.id === item.id ? 'secondary' : 'ghost'} onClick={() => { focusPage.current = false; setNavigation({ group: item.id, page: 0 }) }} onKeyDown={(event) => {
      const last = groups.length - 1
      const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : null
      if (next === null) return
      event.preventDefault()
      focusPage.current = false
      setNavigation({ group: groups[next].id, page: 0 })
      tabRefs.current[next]?.focus()
    }}>
      <item.Icon className="mr-2 h-4 w-4" aria-hidden />{item.label}{' '}<span className="ml-2 text-muted-foreground">{item.items.length}</span>
    </Button>)}</div> : <h3 className="text-sm font-semibold">{group.label}</h3>}
    <div id={`${id}-flag-panel-${group.id}`} role={groups.length > 1 ? 'tabpanel' : undefined} aria-labelledby={groups.length > 1 ? `${id}-flag-tab-${group.id}` : undefined}>
    <ul ref={list} className="space-y-2" onFocusCapture={event => {
      if (!(event.target instanceof HTMLElement)) return
      const index = Array.from(event.currentTarget.children).findIndex(row => row.contains(event.target))
      if (index >= 0) readingPosition.current = { element: event.target, index, group: group.id, page: currentPage }
    }} onBlurCapture={event => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) readingPosition.current = null
    }}>{items.map((flag) => {
      const title = boardFindingTitle(flag.problem, flag.checkId)
      return <li key={flag.id}>
        <div className={`${styles.row} min-h-20 rounded-card bg-muted/35 p-3`}>
          <SiteFlagSelectionCheckbox flagId={flag.id} title={title} />
          <div className={styles.body}>
            <Icon className="mt-3 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 tabIndex={-1} className="rounded-control text-base font-semibold leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><SiteFlagTarget className={styles.open} href={`/sites/${siteId}/flags/${encodeURIComponent(flag.id)}`} onOpen={onOpenFlag ? trigger => onOpenFlag(flag.id, trigger) : undefined}>{title}</SiteFlagTarget></h3>
              {copyAvailability === 'available' && (flag.repairGuidance === 'pending' || flag.repairGuidance === 'unavailable') ? <p className="mt-1 text-xs text-muted-foreground">{SITE_ACTION_COPY.repairGuidance.label[flag.repairGuidance]}</p> : null}
              {showPage ? <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate" title={flag.pageUrl ?? undefined}>{flag.affectedPageCount > 1 ? D.affectedPages(flag.affectedPageCount) : pageLabel(flag.pageUrl)}</span></p> : null}
            </div>
          </div>
          {copyAvailability !== 'available' || hasRepairGuidance(flag.fix) ? <div className={styles.actions}><SitePromptCopyButton availability={copyAvailability} compact siteId={siteId} flagId={flag.id} flagTitle={title} /></div> : null}
        </div>
    </li> })}</ul>
    </div>
    {groups.filter(item => item.id !== group.id).map(item => <div key={item.id} id={`${id}-flag-panel-${item.id}`} role="tabpanel" aria-labelledby={`${id}-flag-tab-${item.id}`} hidden />)}
    {pageCount > 1 ? <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span role="status">{D.range(currentPage * PAGE_SIZE + 1, Math.min((currentPage + 1) * PAGE_SIZE, group.items.length), group.items.length)}</span><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={currentPage === 0} aria-controls={`${id}-flag-panel-${group.id}`} onClick={() => { focusPage.current = true; setNavigation({ group: group.id, page: currentPage - 1 }) }}>{D.previous}</Button><Button variant="ghost" size="sm" disabled={currentPage === pageCount - 1} aria-controls={`${id}-flag-panel-${group.id}`} onClick={() => { focusPage.current = true; setNavigation({ group: group.id, page: currentPage + 1 }) }}>{D.next}</Button></div></div> : null}
    <RecommendationList recommendations={recommendations} />
  </section>
}

export function RecommendationList({ recommendations }: { recommendations: SiteFlagSeed[] }) {
  if (recommendations.length === 0) return null
  return <section className="space-y-2 pt-4" aria-labelledby="recommendations-heading">
    <h3 id="recommendations-heading" className="text-sm font-medium text-muted-foreground">{D.suggestions}</h3>
    <ul className="space-y-2">{recommendations.map((flag) => <li key={flag.id} className="flex min-h-16 items-start gap-3 rounded-card border border-dashed border-border p-3"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden /><div className="min-w-0"><p className="text-sm font-medium">{boardFindingTitle(flag.problem, flag.checkId)}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden />{pageLabel(flag.pageUrl)}</p></div></li>)}</ul>
  </section>
}
