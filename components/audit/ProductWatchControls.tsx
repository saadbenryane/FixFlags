'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { REPORT_COPY } from '@/lib/marketing/copy'

interface ProductWatchControlsProps {
  projectId: string
  canWatch: boolean
  /** Agency can choose daily; Pro is weekly-only. */
  canDaily?: boolean
  initialInterval?: 'weekly' | 'daily' | null
}

export function ProductWatchControls({
  projectId,
  canWatch,
  canDaily = false,
  initialInterval = null,
}: ProductWatchControlsProps) {
  const [interval, setIntervalState] = useState<'weekly' | 'daily' | null>(initialInterval)
  const [saving, setSaving] = useState(false)

  async function save(next: 'weekly' | 'daily' | null) {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/watch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: next }),
      })
      const data = (await res.json().catch(() => null)) as
        | { watchInterval?: string | null; error?: string; message?: string }
        | null
      if (!res.ok) {
        toast.error(data?.error || data?.message || 'Could not update watch')
        return
      }
      setIntervalState(
        data?.watchInterval === 'weekly' || data?.watchInterval === 'daily'
          ? data.watchInterval
          : null
      )
      toast.success(
        next ? `Watching ${next === 'daily' ? 'daily' : 'weekly'}` : 'Product watch off'
      )
    } catch {
      toast.error('Could not update watch')
    } finally {
      setSaving(false)
    }
  }

  if (!canWatch) {
    return (
      <p className="text-sm text-muted-foreground text-pretty">
        {REPORT_COPY.recheckHint.bodyPrefix}{' '}
        <strong>{REPORT_COPY.recheck.label}</strong> {REPORT_COPY.recheckHint.bodySuffix}{' '}
        <Link href="/pricing" className="text-link font-medium underline-offset-2 hover:underline">
          Pro adds weekly watch
        </Link>
        .
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground text-pretty">
        Watch this product: FixFlags re-checks on a schedule and emails you only if something
        regresses.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={interval === 'weekly' ? 'default' : 'outline'}
          disabled={saving}
          onClick={() => void save('weekly')}
        >
          Weekly
        </Button>
        {canDaily ? (
          <Button
            type="button"
            size="sm"
            variant={interval === 'daily' ? 'default' : 'outline'}
            disabled={saving}
            onClick={() => void save('daily')}
          >
            Daily
          </Button>
        ) : null}
        {interval ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => void save(null)}
          >
            Turn off
          </Button>
        ) : null}
      </div>
    </div>
  )
}
