'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PublicConnection } from '@/lib/sites/connections/match'

type NotificationLevel = 'FLAGS' | 'CRITICAL_ONLY' | 'OFF'
type GoogleProvider = 'SEARCH_CONSOLE' | 'ANALYTICS'

const emptyConnection = (provider: GoogleProvider): PublicConnection => ({
  provider,
  configured: false,
  status: 'not_connected',
  propertyLabel: null,
  detail: null,
  lastSyncedAt: null,
})

export function SiteSettingsControls({
  siteId,
  watch,
  initial,
}: {
  siteId: string
  watch?: { label: string; lastError: string | null; covered: boolean }
  initial: {
    notificationLevel: NotificationLevel
    notifyOnRecovery: boolean
    shopify: { state: 'connected' | 'unavailable' | 'not_connected'; domain: string | null }
    searchConsole?: PublicConnection
    analytics?: PublicConnection
  }
}) {
  const router = useRouter()
  const [level, setLevel] = useState(initial.notificationLevel)
  const [recovery, setRecovery] = useState(initial.notifyOnRecovery)
  const [shop, setShop] = useState(initial.shopify.domain ?? '')
  const [searchConsole, setSearchConsole] = useState(initial.searchConsole ?? emptyConnection('SEARCH_CONSOLE'))
  const [analytics, setAnalytics] = useState(initial.analytics ?? emptyConnection('ANALYTICS'))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function saveNotifications() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationLevel: level, notifyOnRecovery: recovery }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string }
      setMessage(response.ok ? 'Notification preferences saved.' : body.error ?? 'Could not save preferences.')
    } finally {
      setBusy(false)
    }
  }

  async function connectShopify() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/connections/shopify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      })
      const body = await response.json().catch(() => ({})) as { authorizeUrl?: string; error?: string }
      if (response.ok && body.authorizeUrl) {
        window.location.assign(body.authorizeUrl)
        return
      }
      setMessage(body.error ?? 'Could not connect Shopify.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnectShopify() {
    setBusy(true)
    try {
      const response = await fetch(`/api/sites/${siteId}/connections/shopify`, { method: 'DELETE' })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (response.ok) {
        setShop('')
        setMessage('Shopify disconnected from this Site.')
        router.refresh()
      } else {
        setMessage(body.error ?? 'Could not disconnect Shopify.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function connectGoogle(provider: GoogleProvider) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/connections/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, action: 'connect' }),
      })
      const body = await response.json().catch(() => ({})) as { authorizeUrl?: string; error?: string }
      if (response.ok && body.authorizeUrl) {
        window.location.assign(body.authorizeUrl)
        return
      }
      setMessage(body.error ?? 'Could not start the Google connection.')
    } finally {
      setBusy(false)
    }
  }

  async function syncGoogle(provider: GoogleProvider) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/connections/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, action: 'sync' }),
      })
      const body = await response.json().catch(() => ({})) as { detail?: string; error?: string }
      setMessage(response.ok ? body.detail ?? 'Connection updated.' : body.error ?? 'Could not refresh this connection.')
      if (response.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function disconnectGoogle(provider: GoogleProvider) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/connections/google`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string }
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
    } finally {
      setBusy(false)
    }
  }

  async function removeSite() {
    if (!window.confirm('Remove this Site, stop Watch, and disconnect Shopify?')) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}`, { method: 'DELETE' })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        setMessage(body.error ?? 'Could not remove this Site.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function setWatch(interval: 'weekly' | 'daily' | null) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string; interval?: string }
      if (!response.ok) {
        setMessage(body.error ?? 'Could not update Watch.')
        return
      }
      setMessage(interval ? `Watch is ${body.interval ?? interval}.` : 'Watch is paused.')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="text-lg font-semibold">Watch</h2>
        <p className="mt-1 text-sm text-muted-foreground">{watch?.label ?? 'Not watching'}</p>
        {watch?.lastError ? <p className="mt-2 text-sm text-muted-foreground">{watch.lastError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={watch?.covered ? 'outline' : 'brand'} disabled={busy} onClick={() => void setWatch('weekly')}>Weekly</Button>
          <Button variant="outline" disabled={busy} onClick={() => void setWatch('daily')}>Daily</Button>
          <Button variant="outline" disabled={busy || !watch?.covered} onClick={() => void setWatch(null)}>Pause</Button>
        </div>
      </section>
      <section className="rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose when Watch should email you.</p>
        <label className="mt-4 block text-sm font-medium" htmlFor="site-notification-level">Email me</label>
        <select
          id="site-notification-level"
          className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3"
          value={level}
          onChange={(event) => setLevel(event.target.value as NotificationLevel)}
        >
          <option value="FLAGS">New and regressed Flags</option>
          <option value="CRITICAL_ONLY">Critical Flags only</option>
          <option value="OFF">No Flag emails</option>
        </select>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={recovery} onChange={(event) => setRecovery(event.target.checked)} />
          Email me when a previously flagged problem is verified as recovered
        </label>
        <Button className="mt-4" variant="outline" disabled={busy} onClick={() => void saveNotifications()}>
          Save notifications
        </Button>
      </section>

      <h2 className="text-lg font-semibold lg:col-span-2">Connections</h2>
      <section className="rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="text-lg font-semibold">Shopify</h2>
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
      </section>
      <GoogleConnectionCard
        title="Search Console"
        description="Show queries and pages that earn impressions. The numbers sit beside the independent check."
        connection={searchConsole}
        busy={busy}
        onConnect={() => void connectGoogle('SEARCH_CONSOLE')}
        onSync={() => void syncGoogle('SEARCH_CONSOLE')}
        onDisconnect={() => void disconnectGoogle('SEARCH_CONSOLE')}
      />
      <GoogleConnectionCard
        title="Analytics"
        description="Show which watched pages people open. Session counts stay context. FixFlags still verifies the Outcome itself."
        connection={analytics}
        busy={busy}
        onConnect={() => void connectGoogle('ANALYTICS')}
        onSync={() => void syncGoogle('ANALYTICS')}
        onDisconnect={() => void disconnectGoogle('ANALYTICS')}
      />
      {message ? <p className="text-sm text-muted-foreground lg:col-span-2" role="status">{message}</p> : null}
      <section className="rounded-2xl border border-border/80 bg-background p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold">Developer access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          API keys and MCP act for your account. A run names this Site and includes an idempotency key.
        </p>
        <p className="mt-3 text-sm">Site <strong className="font-mono text-xs">{siteId}</strong></p>
        <p className="mt-1 text-sm">MCP <strong className="font-mono text-xs">/api/mcp</strong></p>
        <Button className="mt-4" variant="outline" asChild>
          <a href="/settings/api-keys">API keys</a>
        </Button>
      </section>
      <section className="rounded-2xl border border-destructive/30 bg-background p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold">Remove Site</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stops Watch, disconnects Shopify, and removes this Site from your account.
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
  onSync,
  onDisconnect,
}: {
  title: string
  description: string
  connection: PublicConnection
  busy: boolean
  onConnect: () => void
  onSync: () => void
  onDisconnect: () => void
}) {
  const linked = connection.status === 'connected' || connection.status === 'mismatch' || connection.status === 'needs_reauth'
  return (
    <section className="rounded-2xl border border-border/80 bg-background p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {connection.propertyLabel ? (
        <p className="mt-3 text-sm">Property <strong>{connection.propertyLabel}</strong></p>
      ) : null}
      {connection.configured && connection.detail ? <p className="mt-2 text-sm text-muted-foreground">{connection.detail}</p> : null}
      {connection.lastSyncedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">Last read {new Date(connection.lastSyncedAt).toLocaleString()}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {!connection.configured ? (
          <p className="text-sm text-muted-foreground">{connection.detail ?? 'Google sign-in is not configured on this FixFlags server yet.'}</p>
        ) : linked ? (
          <>
            <Button variant="outline" disabled={busy} onClick={onSync}>Refresh</Button>
            <Button variant="outline" disabled={busy} onClick={onDisconnect}>Disconnect</Button>
            {connection.status !== 'connected' ? (
              <Button variant="brand" disabled={busy} onClick={onConnect}>Reconnect</Button>
            ) : null}
          </>
        ) : (
          <Button variant="brand" disabled={busy} onClick={onConnect}>Connect {title}</Button>
        )}
      </div>
    </section>
  )
}
