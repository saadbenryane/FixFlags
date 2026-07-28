'use client'

import { useState } from 'react'
import { Link2, Loader2, Search, Unlink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'

interface Props {
  connected: boolean
  siteUrl?: string | null
}

export function GscConnectionCard({ connected, siteUrl }: Props) {
  const [busy, setBusy] = useState(false)
  const { confirm, confirmDialog } = useConfirm()

  async function handleConnect() {
    setBusy(true)
    window.location.href = '/api/integrations/gsc/connect'
  }

  async function handleDisconnect() {
    const ok = await confirm({
      title: 'Disconnect Search Console',
      description:
        'Your reports will no longer include search performance data. This will not delete past data.',
      confirmLabel: 'Disconnect',
      destructive: true,
    })
    if (!ok) return

    setBusy(true)
    try {
      await fetch('/api/integrations/gsc/disconnect', { method: 'POST' })
      window.location.reload()
    } catch {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className="border-0 p-5 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/70">
              <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-heading text-foreground">
                Google Search Console
              </p>
              <p className="text-xs text-muted-foreground">
                {connected
                  ? `Connected to ${siteUrl ?? 'your property'}`
                  : 'Connect to see search performance, indexing status, and keyword data in your reports'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {connected ? (
              <>
                <Badge
                  variant="outline"
                  className="text-success border-success/30 bg-success/5 text-xs gap-1"
                >
                  <Link2 className="h-3 w-3" aria-hidden />
                  Connected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Unlink className="h-4 w-4" aria-hidden />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Disconnect</span>
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Link2 className="h-4 w-4" aria-hidden />
                )}
                <span className="ml-1.5">Connect</span>
              </Button>
            )}
          </div>
        </div>
      </Card>
      {confirmDialog}
    </>
  )
}
