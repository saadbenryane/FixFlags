'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, Flag, Globe2, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { SITE_PAGE_REVIEW_COPY as C } from '@/lib/marketing/copy/site-page-review'
import { BOARD_CARD_ICONS } from './BoardCard'
import { flagReviewVisual } from './flag-review-visual'
import s from './PageFlagReview.module.css'

export type PageReviewFlag = {
  id: string; title: string; evidence: string; area: SiteCardArea; checkId?: string | null;
  priorityBand?: 'fix_first' | 'other';
}
export type PageReviewPage = {
  url: string; label: string; status: string;
  capture?: { src: string; alt: string } | null; flags: readonly PageReviewFlag[];
}
type Renderers = {
  renderFlagActions: (flag: PageReviewFlag) => ReactNode;
  renderFlagDetails: (flag: PageReviewFlag) => ReactNode;
  renderPageActions?: (page: PageReviewPage) => ReactNode;
}

function Capture({ page }: { page: PageReviewPage }) {
  const [failed, setFailed] = useState<string | null>(null)
  const unavailable = page.capture ? C.captureUnavailable : C.noCapture
  return page.capture && failed !== page.capture.src ?
    // Capture bytes retain their own recorded page identity and viewer boundary.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={page.capture.src} alt={page.capture.alt} width={1280} height={900} onError={() => setFailed(page.capture!.src)} /> :
    <span className={s.captureEmpty} role="img" aria-label={`${page.label}: ${unavailable}`}><Globe2 size={22} aria-hidden />{unavailable}</span>
}

export function FlagReviewNavigation({ flags, index, onChange, panelId }: {
  flags: readonly { id: string; title: string }[]; index: number; onChange: (index: number) => void; panelId: string;
}) {
  return <div className={s.navigation} aria-label={C.progress}>
    <label className={s.position}>
      <span role="status" aria-live="polite">{C.position(index, flags.length)}</span><ChevronDown size={12} aria-hidden />
      <select aria-label={C.progress} aria-controls={panelId} value={index} onChange={event => onChange(Number(event.target.value))}>
        {flags.map((flag, position) => <option key={flag.id} value={position}>{C.choose(position, flag.title)}</option>)}
      </select>
    </label>
    <Button variant="ghost" size="icon" aria-label={C.previous} aria-disabled={index === 0} onClick={() => { if (index > 0) onChange(index - 1) }}><ArrowLeft aria-hidden /></Button>
    <Button variant="ghost" size="icon" aria-label={C.next} aria-disabled={index === flags.length - 1} onClick={() => { if (index < flags.length - 1) onChange(index + 1) }}><ArrowRight aria-hidden /></Button>
  </div>
}

function FlagSlide({ flag, index, renderFlagActions, renderFlagDetails }: { flag: PageReviewFlag; index: number } & Renderers) {
  const [expanded, setExpanded] = useState(false)
  const { icon: Icon, device } = flagReviewVisual(flag.area, flag.checkId)
  const Device = device === 'mobile' ? Smartphone : Monitor
  return <article className={s.flagCard} aria-label={C.choose(index, flag.title)}>
    <div className={s.flagMeta}><span className={s.kind}><span className={s.issueIcon}><Icon size={23} strokeWidth={1.6} aria-hidden /></span>{CARD_CATALOG[flag.area].name}</span>
      {device ? <span className={s.device}><Device size={14} aria-hidden />{C.devices[device]}</span> : null}</div>
    {flag.priorityBand === 'fix_first' ? <span className={s.priority}><Flag size={12} aria-hidden />{C.highPriority}</span> : null}
    <h2 title={flag.title}>{flag.title}</h2>
    <div className={s.observed}><span>{C.observed}</span><p>{flag.evidence || C.unavailable}</p></div>
    <div className={s.cardActions}>{renderFlagActions(flag)}</div>
    <details className={s.details} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>{C.details}<ChevronDown size={13} aria-hidden /></summary>
      {expanded ? <div className={s.evidence}>{renderFlagDetails(flag)}</div> : null}
    </details>
  </article>
}

function PageFlagStrip({ page, ...renderers }: { page: PageReviewPage } & Renderers) {
  const [selectedId, setSelectedId] = useState(page.flags[0]?.id ?? '')
  const index = Math.max(0, page.flags.findIndex(flag => flag.id === selectedId))
  const membership = page.flags.map(flag => flag.id).join(':')
  const track = useRef<HTMLDivElement>(null)
  const settled = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const active = useRef(index)
  const panelId = useId()
  useLayoutEffect(() => { active.current = index }, [index])
  useEffect(() => () => clearTimeout(settled.current), [])
  useLayoutEffect(() => {
    clearTimeout(settled.current)
    const element = track.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const card = element.children[active.current] as HTMLElement | undefined
      if (card) element.scrollLeft = card.offsetLeft
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [membership])
  function choose(next: number) {
    const element = track.current
    const card = element?.children[next] as HTMLElement | undefined
    if (!element || !card) return
    setSelectedId(page.flags[next].id)
    element.scrollTo({ left: card.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  function recordPosition() {
    clearTimeout(settled.current)
    settled.current = setTimeout(() => {
      const element = track.current
      if (!element) return
      const cards = Array.from(element.children) as HTMLElement[]
      if (!cards.length) return
      const nearest = cards.reduce((best, card, position) => Math.abs(card.offsetLeft - element.scrollLeft) < Math.abs(cards[best].offsetLeft - element.scrollLeft) ? position : best, 0)
      if (page.flags[nearest]) setSelectedId(page.flags[nearest].id)
    }, 120)
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    choose(event.key === 'Home' ? 0 : event.key === 'End' ? page.flags.length - 1 : Math.max(0, Math.min(page.flags.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1))))
  }
  const groups = new Map<SiteCardArea, number>()
  for (const flag of page.flags) groups.set(flag.area, (groups.get(flag.area) ?? 0) + 1)
  return <section className={s.workspace} aria-label={page.label === '/' ? C.home : page.label}>
    <aside className={s.summary} aria-label={C.pageSummary}>
      <div className={s.pageCapture}><Capture page={page} /></div>
      <div className={s.pageIdentity}><h2><Globe2 size={16} aria-hidden />{page.label === '/' ? C.home : page.label}</h2><p>{page.label}</p></div>
      <div className={s.total}><strong>{page.flags.length}</strong><span><Flag size={13} aria-hidden />{C.flagsLabel}</span></div>
      <dl className={s.categories}>{[...groups].map(([area, count]) => {
        const Icon = BOARD_CARD_ICONS[area]
        return <div key={area}><dt><Icon size={14} aria-hidden />{CARD_CATALOG[area].name}</dt><dd>{count}</dd></div>
      })}</dl>
      {page.flags.length && renderers.renderPageActions ? <details className={s.batch}><summary>{C.fixPage}<ChevronDown size={13} aria-hidden /></summary><div className={s.batchContent}>{renderers.renderPageActions(page)}</div></details> : null}
    </aside>
    <div className={s.reviewArea}>
      <header className={s.stripHeader}><h2>{C.pageFlags}</h2>{page.flags.length ? <FlagReviewNavigation flags={page.flags} index={index} onChange={choose} panelId={panelId} /> : null}</header>
      {page.flags.length ? <>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- This labelled scroll region needs a keyboard stop and bounded arrow navigation. */}
        <div ref={track} id={panelId} className={s.track} role="region" aria-label={C.pageFlags} tabIndex={0} onScroll={recordPosition} onKeyDown={keyboard}>
          {page.flags.map((flag, position) => <FlagSlide key={flag.id} flag={flag} index={position} {...renderers} />)}
        </div>
      </> : <div className={s.empty}><Flag size={24} aria-hidden /><p>{C.noPageFlags}</p><span>{C.recordedScope}</span></div>}
    </div>
  </section>
}

/** Shared visual navigation. Product and illustrative sample supply their own commands. */
export function PageFlagReview({ pages, ...renderers }: { pages: readonly PageReviewPage[] } & Renderers) {
  const [selectedPage, setSelectedPage] = useState<string | null>(null)
  const page = pages.find(item => item.url === selectedPage) ?? pages.find(item => item.flags.length) ?? pages[0]
  return <div className={s.pages}>
    <div className={s.pageHeading}>{pages.length > 1 ? <label><Globe2 size={15} aria-hidden /><select aria-label={C.choosePage} value={page?.url} onChange={event => setSelectedPage(event.target.value)}>{pages.map(item => <option key={item.url} value={item.url}>{item.label} ({C.flags(item.flags.length)})</option>)}</select></label> : <span>{C.page}</span>}<span>{C.pageResults(pages.length)}</span></div>
    {page ? <PageFlagStrip key={page.url} page={page} {...renderers} /> : <p role="status">{C.noPages}</p>}
  </div>
}
