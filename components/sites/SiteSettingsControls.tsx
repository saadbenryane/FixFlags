'use client'

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
import { fetchSiteAction, readSiteActionResponse, siteActionMessage, SiteActionError } from '@/lib/sites/client-actions'

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
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const alertNotice = watch.alert ? siteWatchAlertNotice(watch.alert) : null
  function reportError(error: unknown) {
    setMessage(siteActionMessage(error))
    if (error instanceof SiteActionError && error.status === 401) setAuthRequired(true)
  }

  async function saveNotifications() {
    if (!level || recovery == null) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetchSiteAction(`/api/sites/${siteId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationLevel: level, notifyOnRecovery: recovery }),
      })
      const body = await readSiteActionResponse(response)
      setMessage(response.ok ? 'Notification preferences saved.' : body.error ?? 'Could not save preferences.')
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  async function connectShopify() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetchSiteAction(`/api/sites/${siteId}/connections/shopify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      })
      const body = await readSiteActionResponse(response)
      if (response.ok && body.authorizeUrl) {
        window.location.assign(body.authorizeUrl)
        return
      }
      setMessage(body.error ?? 'Could not connect Shopify.')
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  async function disconnectShopify() {
    setBusy(true)
    try {
      const response = await fetchSiteAction(`/api/sites/${siteId}/connections/shopify`, { method: 'DELETE' })
      const body = await readSiteActionResponse(response)
      if (response.ok) {
        setShop('')
        setMessage('Shopify disconnected from this Site.')
        router.refresh()
      } else {
        setMessage(body.error ?? 'Could not disconnect Shopify.')
      }
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  async function connectGoogle(provider: GoogleProvider) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetchSiteAction(`/api/sites/${siteId}/connections/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, action: 'connect' }),
      })
      const body = await readSiteActionResponse(response)
      if (response.ok && body.authorizeUrl) {
        window.location.assign(body.authorizeUrl)
        return
      }
      setMessage(body.error ?? 'Could not start the Google connection.')
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  async function disconnectGoogle(provider: GoogleProvider) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetchSiteAction(`/api/sites/${siteId}/connections/google`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const body = await readSiteActionResponse(response)
      if (!response.ok) {
        setMessage(body.error ?? 'Could not disconnect this provider.')
        return
      }
      const next = provider === 'SEARCH_CONSOLE'
        ? { ...searchConsole, status: 'revoked' as const, detail: 'Disconnected. Earlier numbers stay on the Site.' }
        : { ...analytics, status: 'revoked' as const, detail: 'Disconnected. Earlier numbers stay on the Site.' }
      if (provider === 'SEARCH_CONSOLE') setSearchConsole(next)
      else setAnalytics(next)
      setMessage(provider === 'SEARCH_CONSOLE' ? 'Search Console disconnected from this Site.' : 'Analytics disconnected from this Site.')
      router.refresh()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  async function removeSite() {
    if (!window.confirm('Remove this Site, stop Watch, and disconnect Shopify?')) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetchSiteAction(`/api/sites/${siteId}`, { method: 'DELETE' })
      const body = await readSiteActionResponse(response)
      if (!response.ok) {
        setMessage(body.error ?? 'Could not remove this Site.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <section id="watch" className="rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="text-lg font-semibold">Monitoring</h2>
        <p className="mt-1 text-sm text-muted-foreground">{watch.label}</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {watch.nextRunAt ? <div><dt className="text-xs text-muted-foreground">Next analysis</dt><dd>{formatEvidenceTimestamp(watch.nextRunAt)}</dd></div> : null}
          {watch.lastRunAt ? <div><dt className="text-xs text-muted-foreground">Last successful analysis</dt><dd>{formatEvidenceTimestamp(watch.lastRunAt)}</dd></div> : null}
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
      </section>
      <section className="rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {level == null || recovery == null ? <p className="mt-1 text-sm text-muted-foreground">{SITE_BOARD_COPY.notificationsUnavailable}</p> : <>
        <p className="mt-1 text-sm text-muted-foreground">Choose when monitoring should email you.</p>
        <label className="mt-4 block text-sm font-medium" htmlFor="site-notification-level">Email me</label>
        <select
          id="site-notification-level"
          className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3"
          value={level}
          onChange={(event) => setLevel(event.target.value as NotificationLevel)}
        >
          <option value="FLAGS">New and regressed Flags</option>
          <option value="CRITICAL_ONLY">Fix-first Flags only</option>
          <option value="OFF">No Flag emails</option>
        </select>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={recovery} onChange={(event) => setRecovery(event.target.checked)} />
          Email me when a previously flagged problem is verified as recovered
        </label>
        <Button className="mt-4" variant="outline" disabled={busy} onClick={() => void saveNotifications()}>
          Save notifications
        </Button>
        </>}
      </section>

      <h2 id="connections" className="text-lg font-semibold">Connections</h2>
      {initial.shopify.configured === false ? null : <section id="connection-shopify" className="rounded-2xl border border-border/80 bg-background p-5">
        <h3 className="text-lg font-semibold">Shopify</h3>
        <Link href="/docs/integrations/shopify" className="inline-flex min-h-11 items-center text-sm text-link">Read Shopify integration guide</Link>
        <p className="mt-1 text-sm text-muted-foreground">
          Add purchase-path evidence to this Site’s Conversion card and Flags.
        </p>
        {initial.shopify.state === 'connected' && initial.shopify.domain ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">Connected to <strong>{initial.shopify.domain}</strong></p>
            <Button variant="outline" disabled={busy} onClick={() => void disconnectShopify()}>Disconnect</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {initial.shopify.state === 'unavailable' ? (
              <p className="text-sm text-brand">The previous installation is unavailable. Reconnect to resume.</p>
            ) : null}
            <Input value={shop} onChange={(event) => setShop(event.target.value)} placeholder="your-store.myshopify.com" aria-label="Shopify store domain" />
            <Button variant="brand" disabled={busy || !shop.trim()} onClick={() => void connectShopify()}>Connect Shopify</Button>
          </div>
        )}
      </section>}
      {searchConsole.configured ? <GoogleConnectionCard
        title="Search Console"
        description="Show queries and pages that earn impressions. The numbers sit beside the independent check."
        connection={searchConsole}
        busy={busy}
        onConnect={() => void connectGoogle('SEARCH_CONSOLE')}
        onDisconnect={() => void disconnectGoogle('SEARCH_CONSOLE')}
      /> : null}
      {analytics.configured ? <GoogleConnectionCard
        title="Analytics"
        description="Show which watched pages people open. Session counts stay context. FixFlags still verifies the Outcome itself."
        connection={analytics}
        busy={busy}
        onConnect={() => void connectGoogle('ANALYTICS')}
        onDisconnect={() => void disconnectGoogle('ANALYTICS')}
      /> : null}
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      {authRequired ? <Button variant="outline" asChild><Link href={`/sign-in?next=${encodeURIComponent(`/sites/${siteId}/settings`)}`}>Sign in again</Link></Button> : null}
      <section className="rounded-2xl border border-destructive/30 bg-background p-5">
        <h2 className="text-lg font-semibold">Remove Site</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stops monitoring, disconnects Site connections, and removes this Site from your account.
        </p>
        <Button className="mt-4" variant="destructive" disabled={busy} onClick={() => void removeSite()}>
          Remove Site
        </Button>
      </section>
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
}: {
  title: string
  description: string
  connection: PublicConnection
  busy: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const linked = connection.status === 'connected'
  const reconnect = connection.status === 'mismatch' || connection.status === 'needs_reauth' || connection.status === 'revoked'
  return (
    <section id={title === 'Search Console' ? 'connection-search-console' : 'connection-analytics'} className="rounded-2xl border border-border/80 bg-background p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <Link href={title === 'Search Console' ? '/docs/integrations/google-search-console' : '/docs/integrations/google-analytics'} className="inline-flex min-h-11 items-center text-sm text-link">Read {title === 'Search Console' ? 'Search Console' : 'Analytics'} integration guide</Link>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {connection.propertyLabel ? (
        <p className="mt-3 text-sm">Property <strong>{connection.propertyLabel}</strong></p>
      ) : null}
      {connection.configured && connection.detail ? <p className="mt-2 text-sm text-muted-foreground">{connection.detail}</p> : null}
      {connection.lastSyncedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">Last read {formatEvidenceTimestamp(connection.lastSyncedAt)}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {linked ? (
          <Button variant="outline" disabled={busy} onClick={onDisconnect}>Disconnect</Button>
        ) : reconnect ? (
          <Button variant="brand" disabled={busy} onClick={onConnect}>Reconnect</Button>
        ) : (
          <Button variant="brand" disabled={busy} onClick={onConnect}>Connect {title}</Button>
        )}
      </div>
    </section>
  )
}
