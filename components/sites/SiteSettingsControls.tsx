'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type NotificationLevel = 'FLAGS' | 'CRITICAL_ONLY' | 'OFF'

export function SiteSettingsControls({
  siteId,
  initial,
}: {
  siteId: string
  initial: {
    notificationLevel: NotificationLevel
    notifyOnRecovery: boolean
    shopify: { state: 'connected' | 'unavailable' | 'not_connected'; domain: string | null }
  }
}) {
  const router = useRouter()
  const [level, setLevel] = useState(initial.notificationLevel)
  const [recovery, setRecovery] = useState(initial.notifyOnRecovery)
  const [shop, setShop] = useState(initial.shopify.domain ?? '')
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
      } else {
        setMessage(body.error ?? 'Could not disconnect Shopify.')
      }
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
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
      {message ? <p className="text-sm text-muted-foreground lg:col-span-2" role="status">{message}</p> : null}
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
