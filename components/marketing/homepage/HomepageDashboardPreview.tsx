'use client'

import { useState } from 'react'
import { Copy, Radio, RefreshCw } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { BoardCard, BoardGrid, BoardStatus, BoardSummaryStrip } from '@/components/sites/BoardCard'
import { SitePreviewCard } from '@/components/layout/SitePreviewCard'
import { UptimeCard } from '@/components/uptime/UptimeCard'
import { SiteWorkspaceNavigation, SITE_ROUTES, type SiteRoute } from '@/components/sites/SiteWorkspaceNavigation'
import { SiteMonitoringHistory } from '@/components/sites/SiteMonitoringHistory'
import { MonitoringScheduleEditor } from '@/components/sites/MonitoringScheduleEditor'
import { SiteIntegrationsPanel, type GoogleProvider } from '@/components/sites/SiteIntegrationsPanel'
import { SiteAccountChecksPanel, SiteMonitoringSettingsPanel, SiteNotificationSettingsPanel, SiteRemovalSettingsPanel, type NotificationLevel } from '@/components/sites/SiteSettingsPanels'
import { TechnologyStrip } from '@/components/sites/SiteTooling'
import { nextCheckCompactLabel, nextCheckLabel, scheduleLabel, scheduleMilliseconds, type MonitoringSchedule } from '@/lib/sites/monitoring-schedule'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { BOARD_PREVIEW_COPY as B } from '@/lib/marketing/copy/board-preview'
import { MONITORING_SCHEDULE_COPY as M } from '@/lib/marketing/copy/monitoring'
import { SITE_SETTINGS_COPY as Settings } from '@/lib/marketing/copy/site-settings'
import { SITE_WORKSPACE_COPY as W } from '@/lib/marketing/copy/workspace'
import { DASHBOARD_PREVIEW_COPY as P, SAMPLE_ACCOUNT_CHECKS, SAMPLE_GOOGLE_CONNECTIONS, SAMPLE_UPTIME, sampleUptimeHistory } from '@/lib/marketing/copy/dashboard-preview'
import { HOMEPAGE_SAMPLE as S, SAMPLE_FLAGS, sampleFlagsForCategory, type SampleCategory, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { HOMEPAGE_EVIDENCE } from './HomepagePrimitives'
import shellStyles from '@/components/sites/SiteShell.module.css'
import s from './CareHomepage.module.css'

export function HomepageDashboardPreview({ onOpen, onOpenFlag, onCopyFlag }: {
  onOpen: (card: SiteCardArea) => void; onOpenFlag: (card: SampleCategory, flag: SampleFlagId) => void; onCopyFlag: (card: SampleCategory, flag: SampleFlagId) => void;
}) {
  const [view, setView] = useState<SiteRoute>('home')
  const [notifications, setNotifications] = useState<NotificationLevel>('FLAGS')
  const [recovery, setRecovery] = useState(true)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [schedule, setSchedule] = useState<MonitoringSchedule>({ every: 1, unit: 'days' })
  const [paused, setPaused] = useState(false)
  const [shop, setShop] = useState<string>(P.shop)
  const [shopConnected, setShopConnected] = useState(true)
  const [connections, setConnections] = useState(SAMPLE_GOOGLE_CONNECTIONS)
  const [accountChecks, setAccountChecks] = useState<AccountChecksView>(SAMPLE_ACCOUNT_CHECKS)
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null)
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const nextRunAt = schedule && !paused ? new Date(Math.max(0, scheduleMilliseconds(schedule) - 15 * 60_000)).toISOString() : null
  const nextCheck = nextCheckCompactLabel(nextRunAt, 0)
  const timeline = C.monitoring.timeline.map(event => ({ ...event, dateTime: `2026-09-${event.id.slice(-2)}T09:00:00.000Z`, flags: 'flags' in event ? event.flags.map(flag => ({ ...flag, onOpen: () => {
    const category = S.categories.find(card => sampleFlagsForCategory(card).includes(flag.id as SampleFlagId))
    if (category) onOpenFlag(category, flag.id as SampleFlagId)
  } })) : [] }))
  const summaryItems = S.summaryItems.map(item => 'id' in item && item.id === 'monitoring' ? { ...item, label: paused ? 'Paused' : scheduleLabel(schedule), detail: nextCheck, accessibleDetail: nextCheckLabel(nextRunAt, 0), state: schedule && !paused ? 'healthy' as const : 'unknown' as const } : item)
  const attention = S.categories.filter(card => card.id !== 'uptime' && card.flagCount > 0)
  const other = S.categories.filter(card => card.id !== 'uptime' && card.flagCount === 0).sort((a, b) => Number(a.state === 'unknown') - Number(b.state === 'unknown'))
  const renderCard = (card: SampleCategory) => <BoardCard key={card.id} name={card.name} status={card.status} state={card.state} answer={card.answer} detail={card.context} icon={card.id} flagCount={card.flagCount} freshness={S.freshness}
    flags={sampleFlagsForCategory(card).map(flag => ({ id: flag, title: SAMPLE_FLAGS[flag].title, href: '#product', onOpen: () => onOpenFlag(card, flag), copyAction: <button type="button" className={s.flagCopyAction} aria-label={`Copy fix prompt for ${SAMPLE_FLAGS[flag].title}`} title="Copy fix prompt" onClick={() => onCopyFlag(card, flag)}><Copy size={15} aria-hidden /></button> }))} onOpen={() => onOpen(card.id)} layout="row" />

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

  return <div className={s.board} role="region" aria-label={C.boardAria}>
    <div className={s.browserBar} aria-hidden><span /><span /><span /></div>
    <aside className={s.boardSidebar}>
      <div className={s.boardBrand}><span className={s.boardBrandLockup}><Logo size="sm" /></span><span className={s.boardBrandMark}><Logo variant="mark" size="sm" /></span></div>
      <div className={s.sampleIdentity}><strong>{C.boardHost}</strong><span>{C.boardLabel}</span><small>{S.freshness}</small></div>
      <SiteWorkspaceNavigation activeRoute={view} label={S.navigationLabel} renderItem={({ id, label, selected, className, content }) => <button key={id} type="button" className={className} aria-label={label} aria-pressed={selected} onClick={() => setView(id)}>{content}</button>} />
      <button type="button" className={s.sampleCadence} onClick={() => { setView('settings'); setScheduleOpen(true) }} aria-label={`${W.analysisCadence}: ${paused ? 'Paused' : scheduleLabel(schedule)}`}><Radio size={15} aria-hidden /><span><small>{W.analysisCadence}</small>{paused ? 'Paused' : scheduleLabel(schedule)}</span></button>
    </aside>
    <div className={s.boardMain}>
      <div className={s.boardHeader}><div className={s.boardIdentity}><h3>{SITE_ROUTES.find(([id]) => id === view)?.[1]}</h3></div>
        <div className={s.boardSummary}><a href="#analyze" aria-label="Recheck website" title="Recheck website"><RefreshCw size={15} aria-hidden /></a><BoardStatus state="problem" label={`${S.summary} on this website`} count={S.summaryItems[0].value} onOpen={() => { setView('home'); requestAnimationFrame(() => document.getElementById('sample-website-checks')?.focus()) }} /></div>
      </div>
      {view === 'home' ? <>
        <div className={shellStyles.previewSummary}>
          <SitePreviewCard host={C.boardLabel} captures={[{ auditId: 'sample', device: 'desktop', previous: false, url: HOMEPAGE_EVIDENCE.site, pageUrl: `https://${C.boardLabel}/`, viewport: '1280 × 720', recordedAt: P.checkedAt }]} />
          <section className={shellStyles.findings} aria-label="Findings summary"><h2>{W.findings}</h2>
            <BoardSummaryStrip items={summaryItems} label={S.summaryLabel} onSelect={item => {
              if (item.id === 'monitoring') { setView('settings'); requestAnimationFrame(() => document.getElementById('watch')?.focus()) }
              else if (item.id === 'pages') onOpen('site')
              else { setView('home'); document.getElementById('sample-website-checks')?.focus() }
            }} />
            <p>{P.findings}</p><div className={s.previewToolLogos}><TechnologyStrip items={S.technologies} label={null} onSelect={() => setView('integrations')} /></div>
          </section>
        </div>
        <div id="sample-website-checks" tabIndex={-1}><UptimeCard siteId="sample" summary={{ ...SAMPLE_UPTIME, enabled: Boolean(schedule) && !paused, state: schedule && !paused ? SAMPLE_UPTIME.state : 'paused' }} historySource={sampleUptimeHistory} />
          <BoardGrid className={s.resultRows} layout="rows">{[...attention, ...other].map(renderCard)}</BoardGrid></div>
      </> : null}
      {view === 'timeline' ? <section className={s.boardPane} aria-label={S.navigation.timeline}><p className={s.paneDescription}>{M.historyBody}</p><SiteMonitoringHistory points={C.monitoring.history} events={timeline} emptyMessage={B.noHistory} /></section> : null}
      {view === 'integrations' ? <section className={s.boardPane} aria-label={S.navigation.integrations}><p className={s.paneDescription}>{Settings.connectionsBody}</p><p className={s.sampleNotice}>{B.sampleConnection}</p>
        <SiteIntegrationsPanel shopify={{ configured: true, state: shopConnected ? 'connected' : 'not_connected', domain: shopConnected ? shop : null }} shop={shop} searchConsole={connections.SEARCH_CONSOLE} analytics={connections.ANALYTICS}
          onShopChange={setShop} onConnectShopify={() => { setShopConnected(true); setIntegrationMessage(P.connected('Shopify')) }} onDisconnectShopify={() => { setShopConnected(false); setIntegrationMessage(P.disconnected('Shopify')) }}
          onConnectGoogle={provider => updateConnection(provider, true)} onDisconnectGoogle={provider => updateConnection(provider, false)} onRefreshGoogle={() => setIntegrationMessage(P.refreshed)}
          feedback={integrationMessage ? <p role="status" className={s.sampleNotice}>{integrationMessage}</p> : null} />
      </section> : null}
      {view === 'settings' ? <section className={s.boardPane} aria-label={S.navigation.settings}><p className={s.paneDescription}>{Settings.description}</p><p className={s.sampleNotice}>{P.sample}</p>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <SiteMonitoringSettingsPanel label={scheduleLabel(schedule)} paused={paused} scheduled={Boolean(schedule)} nextCheck={nextCheckLabel(nextRunAt, 0)} lastCheck={formatEvidenceTimestamp(P.checkedAt)} onEdit={() => setScheduleOpen(true)} onPause={setPaused} />
          <SiteNotificationSettingsPanel level={notifications} recovery={recovery} onChange={(level, nextRecovery) => { setNotifications(level); setRecovery(nextRecovery) }} />
          <SiteAccountChecksPanel initial={accountChecks} enabled={accountChecks.enabled} onToggle={enabled => setAccountChecks(current => ({ ...current, enabled }))} onRequest={requestAccountCheck} feedback={accountMessage ? <p role="status" className={s.sampleNotice}>{accountMessage}</p> : null} />
          <SiteRemovalSettingsPanel />
        </div>
      </section> : null}
    </div>
    {scheduleOpen ? <MonitoringScheduleEditor open onOpenChange={setScheduleOpen} schedule={schedule} availableIntervals={['daily', 'weekly']} sample onSave={next => { setSchedule(next); setPaused(false); setScheduleOpen(false) }} /> : null}
  </div>
}
