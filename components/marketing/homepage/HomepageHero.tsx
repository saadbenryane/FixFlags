'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Bot, Clock3, Copy, Flag, LayoutGrid, Plug, RefreshCw, Route, Settings2 } from 'lucide-react'
import { BoardCard, BoardGrid, BoardStatus, BoardSummaryStrip } from '@/components/sites/BoardCard'
import { Logo } from '@/components/brand/Logo'
import { SiteMonitoringHistory } from '@/components/sites/SiteMonitoringHistory'
import { MonitoringScheduleEditor } from '@/components/sites/MonitoringScheduleEditor'
import { nextCheckCompactLabel, nextCheckLabel, scheduleLabel, scheduleMilliseconds, type MonitoringSchedule } from '@/lib/sites/monitoring-schedule'
import { IntegrationList, TechnologyStrip, type ToolItem } from '@/components/sites/SiteTooling'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { BOARD_PREVIEW_COPY as B } from '@/lib/marketing/copy/board-preview'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MONITORING_SCHEDULE_COPY as M } from '@/lib/marketing/copy/monitoring'
import { HOMEPAGE_SAMPLE as S, SAMPLE_FLAGS, sampleFlagsForCategory, type SampleCategory, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HOMEPAGE_EVIDENCE, HomepageIntro, HomepageUrlEntry } from './HomepagePrimitives'
import { HomepageEditorTools } from './HomepageSections'
import s from './CareHomepage.module.css'

export type HomepageDetailCard = SiteCardArea

const BENEFIT_ICONS = [Route, Flag, Bot] as const

export function HomepageHero({ onOpen, onOpenFlag, onCopyFlag }: { onOpen: (card: HomepageDetailCard) => void; onOpenFlag: (card: SampleCategory, flag: SampleFlagId) => void; onCopyFlag: (card: SampleCategory, flag: SampleFlagId) => void }) {
  const [view, setView] = useState<'site' | 'flags' | 'monitoring' | 'integrations' | 'settings'>('site')
  const [notifications, setNotifications] = useState('FLAGS')
  const [recoveryEmails, setRecoveryEmails] = useState(true)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [schedule, setSchedule] = useState<MonitoringSchedule>({ every: 1, unit: 'days' })
  const [integrations, setIntegrations] = useState<ToolItem[]>([...S.integrations])
  const [selectedIntegration, setSelectedIntegration] = useState<ToolItem | null>(null)
  const nextRunAt = schedule ? new Date(Math.max(0, scheduleMilliseconds(schedule) - 15 * 60_000)).toISOString() : null
  const nextCheck = nextCheckCompactLabel(nextRunAt, 0)
  const timeline = C.monitoring.timeline.map(event => ({ ...event, flags: 'flags' in event ? event.flags.map(flag => ({ ...flag, onOpen: () => {
    const category = S.categories.find(card => sampleFlagsForCategory(card).includes(flag.id as SampleFlagId))
    if (category) onOpenFlag(category, flag.id as SampleFlagId)
  } })) : [] }))
  const summaryItems = S.summaryItems.map(item => 'id' in item && item.id === 'monitoring' ? { ...item, label: scheduleLabel(schedule), detail: nextCheck, accessibleDetail: nextCheckLabel(nextRunAt, 0), state: schedule ? 'healthy' as const : 'unknown' as const } : item)
  const attention = S.categories.filter(card => card.flagCount > 0)
  const other = S.categories.filter(card => card.flagCount === 0).sort((a, b) => Number(a.state === 'unknown') - Number(b.state === 'unknown'))
  const ordered = [...attention, ...other]
  const renderCard = (card: SampleCategory) => <BoardCard key={card.id} name={card.name} status={card.status} state={card.state} answer={card.answer} detail={card.context} icon={card.id} flagCount={card.flagCount} freshness={S.freshness} flags={sampleFlagsForCategory(card).map(flag => ({ id: flag, title: SAMPLE_FLAGS[flag].title, href: '#product', onOpen: () => onOpenFlag(card, flag), copyAction: <button type="button" className={s.flagCopyAction} aria-label={`Copy fix prompt for ${SAMPLE_FLAGS[flag].title}`} title="Copy fix prompt" onClick={() => onCopyFlag(card, flag)}><Copy size={15} aria-hidden="true" /></button> }))} onOpen={() => onOpen(card.id)} layout="row" />
  return <>
    <section className={s.hero}>
      <div className={s.heroContent}>
        <p className={s.heroEyebrow}>{C.hero.eyebrow}</p>
        <h1><span className={s.headlineLead}><span className={s.headlineAccent}>{C.headlineAccent}</span>{' '}{C.headlineLines[0]}</span><br /><span className={s.headlineLead}>{C.headlineLines[1]}<span className={s.headlineAccent}>{C.headlinePunctuation}</span></span></h1>
        <p className={s.heroBody}>{C.hero.bodyLines[0]}{' '}<br />{C.hero.bodyLines[1]}</p>
        <ul className={s.heroBenefits} aria-label="What FixFlags does">
          {C.hero.benefits.map((benefit, index) => {
            const Icon = BENEFIT_ICONS[index]
            return <li key={benefit.title}><Icon size={20} aria-hidden="true" /><strong>{benefit.title}</strong></li>
          })}
        </ul>
        <HomepageUrlEntry />
        <HomepageEditorTools />
      </div>
    </section>
    <section className={`${s.section} ${s.sampleSection}`} id="product" tabIndex={-1}>
      <HomepageIntro title={S.title} body={<>{S.subtitle} {S.mcpLead} <Link className={s.introMcpLink} href="/dashboard/mcp-setup">{S.mcpLabel}</Link> {S.mcpBody}</>} />
      <div className={s.board} role="region" aria-label={C.boardAria}>
        <div className={s.browserBar} aria-hidden="true"><span /><span /><span /></div>
        <aside className={s.boardSidebar}>
          <div className={s.boardBrand}><span className={s.boardBrandLockup}><Logo size="sm" /></span><span className={s.boardBrandMark}><Logo variant="mark" size="sm" /></span></div>
          <nav aria-label={S.navigationLabel}>
            <button type="button" aria-label={S.navigation.site} aria-pressed={view === 'site'} onClick={() => setView('site')}><LayoutGrid size={18} aria-hidden="true" /><span>{S.navigation.site}</span></button>
            <button type="button" aria-label={S.navigation.monitoring} aria-pressed={view === 'monitoring'} onClick={() => setView('monitoring')}><Clock3 size={18} aria-hidden="true" /><span>{S.navigation.monitoring}</span></button>
            <button type="button" aria-label={S.navigation.integrations} aria-pressed={view === 'integrations'} onClick={() => setView('integrations')}><Plug size={18} aria-hidden="true" /><span>{S.navigation.integrations}</span></button>
            <button type="button" aria-label={S.navigation.settings} aria-pressed={view === 'settings'} onClick={() => setView('settings')}><Settings2 size={18} aria-hidden="true" /><span>{S.navigation.settings}</span></button>
          </nav>
        </aside>
        <div className={s.boardMain}>
        <div className={s.boardHeader}>
          <div className={s.boardIdentity}>
            <Image src={HOMEPAGE_EVIDENCE.site} alt={S.identityAlt} width={144} height={88} unoptimized loading="eager" />
            <div><strong>{C.boardHost}</strong><span>{C.boardLabel}</span></div>
          </div>
          <div className={s.boardSummary}>
            <span className={s.boardHeaderFreshness}>{S.freshness}</span>
            <a href="#analyze" aria-label="Recheck website" title="Recheck website"><RefreshCw size={15} aria-hidden="true" /></a>
            <BoardStatus state="problem" label={`${S.summary} on this website`} count={S.summaryItems[0].value} />
          </div>
        </div>
        {view === 'site' ? <>
          <div className={s.previewToolLogos}><TechnologyStrip items={S.technologies} label={null} onSelect={() => setView('integrations')} /></div>
          <BoardSummaryStrip items={summaryItems} label={S.summaryLabel} onSelect={item => {
            if (item.label === S.navigation.flags) setView('flags')
            else if (item.id === 'monitoring') setScheduleOpen(true)
            else onOpen('site')
          }} />
          <BoardGrid className={s.resultRows} layout="rows">{ordered.map(card => card.id === 'uptime' ? <div key={card.id} className={card.state === 'attention' ? s.uptimeIncident : undefined}>{renderCard(card)}</div> : renderCard(card))}</BoardGrid>
        </> : null}
        {view === 'flags' ? <>
          <div className={s.boardViewHeading}><div><h3>{S.flagsTitle}</h3><p>Everything that needs attention on this Site.</p></div><button type="button" onClick={() => setView('site')}>{S.allAreas}</button></div>
          <div className={s.flagList}>{attention.flatMap(card => sampleFlagsForCategory(card).map(flag => <button key={flag} type="button" onClick={() => onOpenFlag(card, flag)} aria-label={`Open ${SAMPLE_FLAGS[flag].title}`}><span className={s.flagListArea}>{card.name}</span><strong>{SAMPLE_FLAGS[flag].title}</strong><span className={s.flagListAction}>View Flag <ArrowRight size={16} aria-hidden="true" /></span></button>))}</div>
        </> : null}
        {view === 'monitoring' ? <section className={s.boardPane} aria-labelledby="sample-monitoring-heading">
          <div className={s.boardViewHeading}><div><h3 id="sample-monitoring-heading">{M.title}</h3><p>{M.historyBody}</p></div><button type="button" onClick={() => setView('site')}>{S.allAreas}</button></div>
          <SiteMonitoringHistory points={C.monitoring.history} events={timeline} emptyMessage={B.noHistory} />
        </section> : null}
        {view === 'integrations' ? <section className={s.boardPane} aria-labelledby="sample-integrations-heading">
          <div className={s.boardViewHeading}><div><h3 id="sample-integrations-heading">Integrations</h3><p>{B.integrationsBody}</p></div><button type="button" onClick={() => setView('site')}>{S.allAreas}</button></div>
          <div className={s.previewToolLogos}><IntegrationList items={integrations} label="Suggested and connected integrations" onAction={setSelectedIntegration} /></div>
        </section> : null}
        {view === 'settings' ? <section className={s.boardPane} aria-labelledby="sample-settings-heading">
          <div className={s.boardViewHeading}><h3 id="sample-settings-heading">{S.navigation.settings}</h3><button type="button" onClick={() => setView('site')}>{S.allAreas}</button></div>
          <div className="mt-4 grid min-w-0 gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><strong className="text-sm">{M.title}</strong><Button variant="outline" onClick={() => setScheduleOpen(true)}>{scheduleLabel(schedule)}</Button></div>
            <div className="grid min-w-0 gap-3 border-b border-border pb-4"><h4 className="text-sm font-semibold">{B.notifications}</h4>
              <label className="grid gap-2 text-sm">{B.emailMe}<select className="min-h-11 w-full min-w-0 rounded-control border border-border bg-background px-3" value={notifications} onChange={event => setNotifications(event.target.value)}><option value="FLAGS">{B.newFlags}</option><option value="CRITICAL_ONLY">{B.criticalFlags}</option><option value="OFF">{B.emailsOff}</option></select></label>
              <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input className="mt-1.5 shrink-0" type="checkbox" checked={recoveryEmails} disabled={notifications === 'OFF'} onChange={event => setRecoveryEmails(event.target.checked)} />{B.recoveryEmails}</label>
            </div>
            <Button variant="outline" className="w-fit max-w-full" onClick={() => setView('integrations')}>{B.manageConnections}</Button>
          </div>
        </section> : null}
        </div>
      </div>
    </section>
    <ResponsiveDepth open={Boolean(selectedIntegration)} onOpenChange={open => { if (!open) setSelectedIntegration(null) }}>
      <DialogTitle>{selectedIntegration?.status === B.connected ? B.settingsFor(selectedIntegration.name) : B.connectTool(selectedIntegration?.name ?? '')}</DialogTitle>
      <DialogDescription>{B.sampleConnection}</DialogDescription>
      <p className="text-sm text-muted-foreground">{selectedIntegration?.detail}</p>
      <Button variant="outline" onClick={() => {
        setIntegrations(current => current.map(item => item.name === selectedIntegration?.name ? { ...item, status: item.status === B.connected ? B.connect : B.connected, state: item.status === B.connected ? 'attention' : 'healthy' } : item))
        setSelectedIntegration(null)
      }}>{selectedIntegration?.status === B.connected ? B.disconnectSample : B.connectSample}</Button>
    </ResponsiveDepth>
    {scheduleOpen ? <MonitoringScheduleEditor open onOpenChange={setScheduleOpen} schedule={schedule} availableIntervals={['daily', 'weekly']} sample onSave={next => { setSchedule(next); setScheduleOpen(false) }} /> : null}
  </>
}
