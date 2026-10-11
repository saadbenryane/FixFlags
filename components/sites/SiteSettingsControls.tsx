'use client'

import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SiteSettingsSection } from './SiteSettingsSection'
import { useState } from 'react'
import { SiteMonitoringSchedule } from './SiteMonitoringSchedule'
import { MONITORING_SCHEDULE_COPY as M } from '@/lib/marketing/copy/monitoring'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Input } from '@/components/ui/input'
import { SITE_BOARD_COPY, WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy'
import type { PublicConnection } from '@/lib/sites/connections/match'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { formatAlertDate, siteWatchAlertNotice } from '@/lib/sites/watch-alert-notice'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { connectionPresentation } from '@/lib/sites/connection-presentation'
import { SITE_CONNECTION_COPY as G } from '@/lib/marketing/copy/site-connections'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SiteActionFeedback } from './SiteActionFeedback'

type NotificationLevel = 'FLAGS' | 'CRITICAL_ONLY' | 'OFF'
type GoogleProvider = 'SEARCH_CONSOLE' | 'ANALYTICS'

export function SiteSettingsControls({
  siteId,
  watch,
  initial,
}: {
  siteId: string
  watch: SiteHomeView['watch']
  initial: {
    notificationLevel: NotificationLevel | null
    notifyOnRecovery: boolean | null
    shopify: { configured?: boolean; state: 'connected' | 'unavailable' | 'not_connected'; domain: string | null }
    searchConsole: PublicConnection
    analytics: PublicConnection
  }
}) {
  const router = useRouter()
  const [level, setLevel] = useState<NotificationLevel | null>(initial.notificationLevel)
  const [recovery, setRecovery] = useState<boolean | null>(initial.notifyOnRecovery)
  const [shop, setShop] = useState(initial.shopify.domain ?? '')
  const [searchConsole, setSearchConsole] = useState(initial.searchConsole)
  const [analytics, setAnalytics] = useState(initial.analytics)
  const { busy, message, error, submit } = useSiteAction()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const alertNotice = watch.alert ? siteWatchAlertNotice(watch.alert) : null
  async function saveNotifications() {
    if (!level || recovery == null) return
    await submit(() => executeSiteAction(`/api/sites/${siteId}/settings`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationLevel: level, notifyOnRecovery: recovery }),
    }, 'settings'), () => C.settings.notificationsSaved, () => router.refresh())
  }

  async function connectShopify() {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/shopify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop }),
    }, 'authorize'), body => { window.location.assign(body.authorizeUrl); return null })
  }

  async function disconnectShopify() {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/shopify`, { method: 'DELETE' }, 'acknowledgement'),
      () => { setShop(''); return C.settings.shopifyDisconnected }, () => router.refresh())
  }

  async function connectGoogle(provider: GoogleProvider) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/google`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, action: 'connect' }),
    }, 'authorize'), body => { window.location.assign(body.authorizeUrl); return null })
  }

  async function refreshGoogle(provider: GoogleProvider) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/google`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, action: 'sync' }),
    }, 'connectionSync'), body => {
      const update = (connection: PublicConnection) => ({ ...connection, status: body.status, detail: body.detail })
      if (provider === 'SEARCH_CONSOLE') setSearchConsole(update)
      else setAnalytics(update)
      return body.status === 'connected' ? G.refreshed : body.detail
    }, () => router.refresh())
  }

  async function disconnectGoogle(provider: GoogleProvider) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/connections/google`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }),
    }, 'acknowledgement'), () => {
      const update = (connection: PublicConnection): PublicConnection => ({ ...connection, status: 'revoked', detail: C.settings.disconnectedDetail })
      if (provider === 'SEARCH_CONSOLE') setSearchConsole(update)
      else setAnalytics(update)
      return C.settings.googleDisconnected(provider)
    }, () => router.refresh())
  }

  async function removeSite() {
    if (!window.confirm(C.settings.removeConfirmation)) return
    await submit(() => executeSiteAction(`/api/sites/${siteId}`, { method: 'DELETE' }, 'acknowledgement'),
      () => { router.push('/dashboard'); return null }, () => router.refresh())
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <SiteSettingsSection id="watch">
        <h2 className="text-lg font-semibold">{S.monitoring}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{watch.label}</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {watch.nextRunAt ? <div><dt className="text-xs text-muted-foreground">{S.next}</dt><dd>{formatEvidenceTimestamp(watch.nextRunAt)}</dd></div> : null}
          {watch.lastRunAt ? <div><dt className="text-xs text-muted-foreground">{S.last}</dt><dd>{formatEvidenceTimestamp(watch.lastRunAt)}</dd></div> : null}
        </dl>
        {watch.lastError ? <p className="mt-2 text-sm text-muted-foreground">{watch.lastError}</p> : null}
        {alertNotice ? (
          <div className="mt-3">
            <Callout variant="warning">
              <p className="font-medium">{alertNotice.title}</p>
              <p className="mt-1">{WATCH_ALERT_DELIVERY.undeliveredBody(formatAlertDate(alertNotice.at))}</p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href={alertNotice.actionHref as Route}>{alertNotice.actionLabel}</Link>
              </Button>
            </Callout>
          </div>
        ) : null}
        <Button variant="outline" className="mt-4" onClick={() => setScheduleOpen(true)}>{M.edit}</Button>
        {scheduleOpen ? <SiteMonitoringSchedule siteId={siteId} interval={watch.interval} everyMinutes={watch.everyMinutes} onClose={() => setScheduleOpen(false)} onRefresh={async () => { router.refresh() }} /> : null}
      </SiteSettingsSection>
      <SiteSettingsSection>
        <h2 className="text-lg font-semibold">{S.notifications}</h2>
        {level == null || recovery == null ? <p className="mt-1 text-sm text-muted-foreground">{SITE_BOARD_COPY.notificationsUnavailable}</p> : <>
        <p className="mt-1 text-sm text-muted-foreground">{S.notificationsBody}</p>
        <label className="mt-4 block text-sm font-medium" htmlFor="site-notification-level">{S.emailMe}</label>
        <select
          id="site-notification-level"
          className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3"
          value={level}
          onChange={(event) => setLevel(event.target.value as NotificationLevel)}
        >
          <option value="FLAGS">{S.levels.FLAGS}</option>
          <option value="CRITICAL_ONLY">{S.levels.CRITICAL_ONLY}</option>
          <option value="OFF">{S.levels.OFF}</option>
        </select>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={recovery} onChange={(event) => setRecovery(event.target.checked)} />
          {S.recovery}
        </label>
        <Button className="mt-4" variant="outline" disabled={busy} onClick={() => void saveNotifications()}>
          {S.saveNotifications}
        </Button>
        </>}
      </SiteSettingsSection>

      <h2 id="connections" className="text-lg font-semibold">{S.connections}</h2>
      {initial.shopify.configured === false ? null : <SiteSettingsSection id="connection-shopify">
        <h3 className="text-lg font-semibold">{S.shopify}</h3>
        <Link href="/docs/integrations/shopify" className="inline-flex min-h-11 items-center text-sm text-link">{S.shopifyGuide}</Link>
        <p className="mt-1 text-sm text-muted-foreground">
          {S.shopifyBody}
        </p>
        {initial.shopify.state === 'connected' && initial.shopify.domain ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">{S.connectedTo} <strong>{initial.shopify.domain}</strong></p>
            <Button variant="outline" disabled={busy} onClick={() => void disconnectShopify()}>{G.disconnect}</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {initial.shopify.state === 'unavailable' ? (
              <p className="text-sm text-brand">{S.shopifyUnavailable}</p>
            ) : null}
            <Input value={shop} onChange={(event) => setShop(event.target.value)} placeholder={S.shopPlaceholder} aria-label={S.shopDomain} />
            <Button variant="brand" disabled={busy || !shop.trim()} onClick={() => void connectShopify()}>{S.connectShopify}</Button>
          </div>
        )}
      </SiteSettingsSection>}
      {searchConsole.configured ? <GoogleConnectionCard
        title={S.search}
        description={S.searchBody}
        connection={searchConsole}
        busy={busy}
        onConnect={() => void connectGoogle('SEARCH_CONSOLE')}
        onDisconnect={() => void disconnectGoogle('SEARCH_CONSOLE')}
        onRefresh={() => void refreshGoogle('SEARCH_CONSOLE')}
      /> : null}
      {analytics.configured ? <GoogleConnectionCard
        title={S.analytics}
        description={S.analyticsBody}
        connection={analytics}
        busy={busy}
        onConnect={() => void connectGoogle('ANALYTICS')}
        onDisconnect={() => void disconnectGoogle('ANALYTICS')}
        onRefresh={() => void refreshGoogle('ANALYTICS')}
      /> : null}
      <SiteActionFeedback message={message} error={error} siteId={siteId} />
      <SiteSettingsSection>
        <h2 className="text-lg font-semibold">{S.remove}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {S.removeBody}
        </p>
        <Button className="mt-4" variant="destructive" disabled={busy} onClick={() => void removeSite()}>
          {S.remove}
        </Button>
      </SiteSettingsSection>
    </div>
  )
}

function GoogleConnectionCard({
  title,
  description,
  connection,
  busy,
  onConnect,
  onDisconnect,
  onRefresh,
}: {
  title: string
  description: string
  connection: PublicConnection
  busy: boolean
  onConnect: () => void
  onDisconnect: () => void
  onRefresh: () => void
}) {
  const presentation = connectionPresentation(connection.status, connection.configured)
  const linked = connection.status === 'connected' || connection.status === 'unavailable'
  const reconnect = connection.status === 'mismatch' || connection.status === 'needs_reauth' || connection.status === 'revoked'
  return (
    <SiteSettingsSection id={title === 'Search Console' ? 'connection-search-console' : 'connection-analytics'}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm">{presentation.label}</p>
      <Link href={title === 'Search Console' ? '/docs/integrations/google-search-console' : '/docs/integrations/google-analytics'} className="inline-flex min-h-11 items-center text-sm text-link">{G.guide(title)}</Link>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {connection.propertyLabel ? (
        <p className="mt-3 text-sm">{G.property} <strong>{connection.propertyLabel}</strong></p>
      ) : null}
      {connection.configured && connection.detail ? <p className="mt-2 text-sm text-muted-foreground">{connection.detail}</p> : null}
      {connection.lastSyncedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">{G.lastRead(formatEvidenceTimestamp(connection.lastSyncedAt) ?? connection.lastSyncedAt)}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {linked ? (
          <>
            <Button variant="outline" disabled={busy} onClick={onRefresh}>{G.refresh}</Button>
            <Button variant="outline" disabled={busy} onClick={onDisconnect}>{G.disconnect}</Button>
          </>
        ) : reconnect ? (
          <Button variant="brand" disabled={busy} onClick={onConnect}>{G.reconnect}</Button>
        ) : (
          <Button variant="brand" disabled={busy} onClick={onConnect}>{G.connect} {title}</Button>
        )}
      </div>
    </SiteSettingsSection>
  )
}
