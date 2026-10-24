'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useRef, useState } from 'react'
import { Boxes, Copy, RefreshCw, UserRound } from 'lucide-react'
import Link from 'next/link'
import { PromptPreviewButton } from '@/components/ui/prompt-preview'
import { Logo } from '@/components/brand/Logo'
import { BoardCard } from '@/components/sites/BoardCard'
import { SiteOverview } from '@/components/sites/SiteOverview'
import { SiteOverviewWorkspace } from '@/components/sites/SiteOverviewWorkspace'
import { SitePageResults } from '@/components/sites/SitePageResults'
import { SampleFlagSelection } from './SampleFlagSelection'
import { samplePages } from './sample-pages'
import { SITE_DASHBOARD_COPY as Dashboard } from '@/lib/marketing/copy/site-dashboard'
import { SiteMonitoringMenu } from '@/components/sites/SiteMonitoringMenu'
import { UptimeCard } from '@/components/uptime/UptimeCard'
import { SiteWorkspaceNavigation, SITE_ROUTES, type SiteRoute } from '@/components/sites/SiteWorkspaceNavigation'
import { SiteMonitoringHistory } from '@/components/sites/SiteMonitoringHistory'
import { MonitoringScheduleEditor } from '@/components/sites/MonitoringScheduleEditor'
import { SiteIntegrationsPanel, type GoogleProvider } from '@/components/sites/SiteIntegrationsPanel'
import { SiteAdvancedSettings, SiteAccountChecksPanel, SiteMonitoringSettingsPanel, SiteNotificationSettingsPanel, SiteRemovalSettingsPanel, type NotificationLevel } from '@/components/sites/SiteSettingsPanels'
import { nextCheckLabel, scheduleLabel, scheduleMilliseconds, type MonitoringSchedule } from '@/lib/sites/monitoring-schedule'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { BOARD_PREVIEW_COPY as B } from '@/lib/marketing/copy/board-preview'
import { MONITORING_SCHEDULE_COPY as M } from '@/lib/marketing/copy/monitoring'
import { SITE_SETTINGS_COPY as Settings } from '@/lib/marketing/copy/site-settings'
import { DASHBOARD_PREVIEW_COPY as P, SAMPLE_ACCOUNT_CHECKS, SAMPLE_GOOGLE_CONNECTIONS, SAMPLE_UPTIME, sampleUptimeHistory } from '@/lib/marketing/copy/dashboard-preview'
import { HOMEPAGE_SAMPLE as S, SAMPLE_FLAGS, sampleFlagsForCategory, type SampleCategory, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { HOMEPAGE_EVIDENCE } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

export function HomepageDashboardPreview({ onOpen, onOpenFlag, onCopyFlag, onCopyAll, onViewAll, onCopySelection, accountRail = false }: {
  accountRail?: boolean; onViewAll?: () => string;
  onOpen: (card: SiteCardArea, trigger?: HTMLElement) => void; onOpenFlag: (card: SampleCategory, flag: SampleFlagId, trigger?: HTMLElement) => void; onCopyFlag: (card: SampleCategory, flag: SampleFlagId) => void;
  onCopyAll?: () => void; onCopySelection?: (prompt: string) => void;
}) {
  const [view, setView] = useState<SiteRoute>('home')
  const navigationItems = useRef(new Map<SiteRoute, HTMLButtonElement>())
  const [notifications, setNotifications] = useState<NotificationLevel>('FLAGS')
  const [recovery, setRecovery] = useState(true)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [schedule, setSchedule] = useState<MonitoringSchedule>({ every: 1, unit: 'days' })
  const [paused, setPaused] = useState(false)
  const shop = P.shop
  const [shopConnected, setShopConnected] = useState(true)
  const [connections, setConnections] = useState(SAMPLE_GOOGLE_CONNECTIONS)
  const [accountChecks, setAccountChecks] = useState<AccountChecksView>(SAMPLE_ACCOUNT_CHECKS)
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null)
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const referenceTime = Date.parse(P.checkedAt) + 15 * 60_000
  const nextRunAt = schedule && !paused ? new Date(Date.parse(P.checkedAt) + scheduleMilliseconds(schedule)).toISOString() : null
  const timeline = C.monitoring.timeline.map(event => ({ ...event, dateTime: `2026-09-${event.id.slice(-2)}T09:00:00.000Z`, flags: 'flags' in event ? event.flags.map(flag => ({ ...flag, onOpen: (trigger: HTMLElement) => {
    const category = S.categories.find(card => sampleFlagsForCategory(card).includes(flag.id as SampleFlagId))
    if (category) onOpenFlag(category, flag.id as SampleFlagId, trigger)
  } })) : [] }))
  const summaryItems = S.summaryItems.filter(item => !('id' in item) || item.id !== 'monitoring')
  const renderCard = (card: SampleCategory, layout: 'card' | 'row') => <article key={card.id} aria-label={card.name}><BoardCard compact name={card.name} status={card.status} state={card.state} answer={card.answer} detail={layout === 'row' ? card.context : undefined} icon={card.id} flagCount={card.flagCount} freshness={S.freshness}
    showFlagPreview={layout === 'card' && card.flagCount > 0}
    onOpenFlag={(id, trigger) => onOpenFlag(card, id as SampleFlagId, trigger)}
    flags={sampleFlagsForCategory(card).map(flag => ({ id: flag, title: SAMPLE_FLAGS[flag].title, priorityBand: flag === 'contact' ? 'other' : 'fix_first', href: '#product', onOpen: () => onOpenFlag(card, flag), copyAction: <InteractiveButton type="button" className={s.flagCopyAction} aria-label={`Copy fix prompt for ${SAMPLE_FLAGS[flag].title}`} title="Copy fix prompt" onClick={() => onCopyFlag(card, flag)}><Copy size={15} aria-hidden /></InteractiveButton> }))} onOpen={trigger => onOpen(card.id, trigger)} layout={layout} /></article>

  function updateConnection(provider: GoogleProvider, connected: boolean) {
    setConnections(current => ({ ...current, [provider]: { ...current[provider], status: connected ? 'connected' : 'revoked', propertyLabel: connected ? provider === 'SEARCH_CONSOLE' ? `https://${C.boardLabel}/` : C.boardLabel : null, lastSyncedAt: connected ? P.checkedAt : null } }))
    const name = provider === 'SEARCH_CONSOLE' ? 'Google Search Console' : 'Google Analytics'
    setIntegrationMessage(connected ? P.connected(name) : P.disconnected(name))
  }

  function requestAccountCheck(mode: 'retest' | 'cleanup') {
    setAccountChecks(current => ({ ...current, canCleanup: mode === 'retest', cleanupUnavailableReason: null, accounts: mode === 'retest' ? [{ purpose: 'retained', email: 'test+sample@fixflags.example', state: 'ACTIVE' }] : [],
      results: [{ kind: mode === 'retest' ? 'signed_in' : 'deletion', state: 'verified', detail: mode === 'retest' ? P.accountResult : P.accountCleanupResult, pageUrl: `https://${C.boardLabel}/account`, evidence: {}, checkedAt: P.checkedAt }],
    }))
    setAccountMessage(mode === 'retest' ? P.retested : P.cleanedUp)
  }

  return <div className={`${s.board} ${accountRail ? s.workspaceBoard : ''}`} role="region" aria-label={C.boardAria}>
    <p className={s.sampleLabel}>{S.sampleLabel}</p>
    <div className={s.browserBar} aria-hidden><span /><span /><span /></div>
    {accountRail ? <aside className={s.accountRail} aria-label="App"><Logo variant="mark" size="sm" href="/dashboard" /><Link href="/dashboard" aria-label="Websites" title="Websites"><Boxes size={19} aria-hidden /></Link><Link href="/settings" className={s.accountControl} aria-label="Account settings" title="Account settings"><UserRound size={19} aria-hidden /></Link></aside> : null}
    <aside className={s.boardSidebar}>
      <div className={s.boardBrand}><span className={s.boardBrandLockup}><Logo size="sm" /></span><span className={s.boardBrandMark}><Logo variant="mark" size="sm" /></span></div>
      <div className={s.sampleIdentity}><strong>{C.boardHost}</strong><span>{C.boardLabel}</span><small>{S.freshness}</small></div>
      <SiteWorkspaceNavigation activeRoute={view} label={S.navigationLabel} renderItem={({ id, label, selected, className, content }) => <InteractiveButton key={id} ref={element => { if (element) navigationItems.current.set(id, element); else navigationItems.current.delete(id) }} type="button" className={className} aria-label={label} aria-pressed={selected} onClick={() => setView(id)}>{content}</InteractiveButton>} />
    </aside>
    <div className={s.boardMain} data-site-content>
      <div className={s.boardHeader}><div className={s.boardIdentity}><h3>{SITE_ROUTES.find(([id]) => id === view)?.[1]}</h3></div>
        <div className={s.boardSummary}>{onCopyAll ? <InteractiveButton type="button" onClick={onCopyAll} className="inline-flex min-h-11 items-center gap-2 rounded-control bg-foreground px-3 text-xs text-background"><Copy size={14} aria-hidden />{Dashboard.fixAll}</InteractiveButton> : null}{onViewAll ? <PromptPreviewButton loadPrompt={async () => onViewAll()} /> : null}<SiteMonitoringMenu label={paused ? 'Paused' : scheduleLabel(schedule)} state={schedule && !paused ? 'healthy' : 'unknown'} nextCheck={nextCheckLabel(nextRunAt, referenceTime)} onManage={() => { setView('settings'); setScheduleOpen(true) }} /><a href="#analyze" aria-label="Recheck website" title="Recheck website"><RefreshCw size={15} aria-hidden /></a></div>
      </div>
      {view === 'home' ? <>
        <SiteOverviewWorkspace checksId="sample-website-checks" summary={<SiteOverview host={C.boardLabel} captures={[
          { auditId: 'sample', device: 'desktop', previous: false, url: HOMEPAGE_EVIDENCE.site, pageUrl: `https://${C.boardLabel}/`, viewport: '720 × 440', recordedAt: P.checkedAt },
          { auditId: 'sample', device: 'mobile', previous: false, url: HOMEPAGE_EVIDENCE.siteMobile, pageUrl: `https://${C.boardLabel}/`, viewport: '390 × 844', recordedAt: P.checkedAt },
        ]}
          summaryItems={summaryItems} summaryLabel={S.summaryLabel} technologies={S.technologies}
          onSelectSummary={item => {
            if (item.id === 'pages') { setView('pages'); requestAnimationFrame(() => navigationItems.current.get('pages')?.focus()) }
            else { setView('home'); document.getElementById('sample-website-checks')?.focus() }
          }} onSelectTechnology={() => { setView('integrations'); requestAnimationFrame(() => navigationItems.current.get('integrations')?.focus()) }} />}
          trend={<SiteMonitoringHistory variant="overview" points={C.monitoring.history} events={timeline} emptyMessage={B.noHistory} />}
          items={S.categories.filter(card => card.id !== 'uptime').map(card => ({ id: card.id, flagCount: card.flagCount,
            healthy: card.state === 'healthy' && card.flagCount === 0, render: layout => renderCard(card, layout) }))}
          uptime={<UptimeCard siteId="sample" summary={{ ...SAMPLE_UPTIME, enabled: Boolean(schedule) && !paused, state: schedule && !paused ? SAMPLE_UPTIME.state : 'paused' }} historySource={sampleUptimeHistory} referenceTime={referenceTime} />} />
      </> : null}
      {view === 'timeline' ? <section className={s.boardPane} aria-label={S.navigation.timeline}><p className={s.paneDescription}>{M.historyBody}</p><SiteMonitoringHistory points={C.monitoring.history} events={timeline} emptyMessage={B.noHistory} /></section> : null}
      {view === 'pages' ? <section className={s.boardPane} aria-label={Dashboard.pages}><SampleFlagSelection ids={Object.keys(SAMPLE_FLAGS) as SampleFlagId[]} onCopy={onCopySelection}><SitePageResults pages={samplePages(Object.keys(SAMPLE_FLAGS) as SampleFlagId[], (id, trigger) => {
        const category = S.categories.find(card => sampleFlagsForCategory(card).includes(id))
        if (category) onOpenFlag(category, id, trigger)
      })} /></SampleFlagSelection></section> : null}
      {view === 'integrations' ? <section className={s.boardPane} aria-label={S.navigation.integrations}><p className={s.paneDescription}>{Settings.connectionsBody}</p><p className={s.sampleNotice}>{B.sampleConnection}</p>
        <SiteIntegrationsPanel github={{ configured: true, status: 'not_connected', login: null }} shopify={{ configured: true, state: shopConnected ? 'connected' : 'not_connected', domain: shopConnected ? shop : null }} searchConsole={connections.SEARCH_CONSOLE} analytics={connections.ANALYTICS}
          onDisconnectShopify={() => { setShopConnected(false); setIntegrationMessage(P.disconnected('Shopify')) }}
          onDisconnectGoogle={provider => updateConnection(provider, false)}
          feedback={integrationMessage ? <p role="status" className={s.sampleNotice}>{integrationMessage}</p> : null} />
      </section> : null}
      {view === 'settings' ? <section className={s.boardPane} aria-label={S.navigation.settings}><p className={s.paneDescription}>{Settings.description}</p><p className={s.sampleNotice}>{P.sample}</p>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <SiteMonitoringSettingsPanel target={`https://${C.boardLabel}/`} label={scheduleLabel(schedule)} paused={paused} scheduled={Boolean(schedule)} nextCheck={nextCheckLabel(nextRunAt, referenceTime)} lastCheck={formatEvidenceTimestamp(P.checkedAt)} onEdit={() => setScheduleOpen(true)} onPause={setPaused} />
          <SiteNotificationSettingsPanel level={notifications} recovery={recovery} onChange={(level, nextRecovery) => { setNotifications(level); setRecovery(nextRecovery) }} />
          <SiteAdvancedSettings><SiteAccountChecksPanel initial={accountChecks} enabled={accountChecks.enabled} onToggle={enabled => setAccountChecks(current => ({ ...current, enabled }))} onRequest={requestAccountCheck} feedback={accountMessage ? <p role="status" className={s.sampleNotice}>{accountMessage}</p> : null} /></SiteAdvancedSettings>
          <SiteRemovalSettingsPanel />
        </div>
      </section> : null}
    </div>
    {scheduleOpen ? <MonitoringScheduleEditor open onOpenChange={setScheduleOpen} schedule={schedule} availableIntervals={['daily', 'weekly']} sample onSave={next => { setSchedule(next); setPaused(false); setScheduleOpen(false) }} /> : null}
  </div>
}
