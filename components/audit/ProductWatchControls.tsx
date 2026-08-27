'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PRODUCT_WATCH_COPY, REPORT_COPY } from '@/lib/marketing/copy'

type Interval = 'weekly' | 'daily' | null
type WatchState = {
  watchInterval: Interval
  watchNextRunAt: string | null
  watchLastRunAt: string | null
  watchLastAttemptAt: string | null
  watchConsecutiveFailures: number
  watchLastError: string | null
  readiness: { available: boolean; error: string | null }
}

interface ProductWatchControlsProps {
  projectId: string
  canWatch: boolean
  canDaily?: boolean
  initialInterval?: Interval
  initialState?: Partial<WatchState>
}

const buildInitialState = (interval: Interval, state?: Partial<WatchState>): WatchState => ({
  watchInterval: interval,
  watchNextRunAt: null,
  watchLastRunAt: null,
  watchLastAttemptAt: null,
  watchConsecutiveFailures: 0,
  watchLastError: null,
  readiness: { available: true, error: null },
  ...state,
})

function formatDate(value: string | null): string {
  if (!value) return PRODUCT_WATCH_COPY.never
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ProductWatchControls({
  projectId,
  canWatch,
  canDaily = false,
  initialInterval = null,
  initialState: suppliedInitialState,
}: ProductWatchControlsProps) {
  const [state, setState] = useState<WatchState>(() =>
    buildInitialState(initialInterval, suppliedInitialState)
  )
  const [saving, setSaving] = useState(false)

  async function save(next: Interval) {
    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/watch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: next }),
      })
      const data = await response.json().catch(() => null) as (WatchState & { error?: string; message?: string }) | null
      if (!response.ok || !data) {
        toast.error(data?.error || data?.message || PRODUCT_WATCH_COPY.updateFailed)
        return
      }
      setState(data)
      toast.success(
        next === 'daily'
          ? PRODUCT_WATCH_COPY.successDaily
          : next === 'weekly'
            ? PRODUCT_WATCH_COPY.successWeekly
            : PRODUCT_WATCH_COPY.successOff
      )
    } catch {
      toast.error(PRODUCT_WATCH_COPY.updateFailed)
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
          {PRODUCT_WATCH_COPY.studioLink}
        </Link>.
      </p>
    )
  }

  const statusLine = state.watchInterval
    ? state.watchNextRunAt
      ? `${PRODUCT_WATCH_COPY.nextRun}: ${formatDate(state.watchNextRunAt)}`
      : `${PRODUCT_WATCH_COPY.lastRun}: ${formatDate(state.watchLastRunAt)}`
    : null

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-pretty">{PRODUCT_WATCH_COPY.description}</p>
      <div role="radiogroup" aria-label="Product Watch interval" className="flex flex-wrap gap-2">
        {(['weekly', ...(canDaily ? ['daily'] : []), null] as Interval[]).map((option) => {
          const label = option === 'weekly' ? PRODUCT_WATCH_COPY.weekly : option === 'daily' ? PRODUCT_WATCH_COPY.daily : PRODUCT_WATCH_COPY.off
          return (
            <button
              key={option ?? 'off'}
              type="button"
              role="radio"
              aria-checked={state.watchInterval === option}
              disabled={saving || (option !== null && !state.readiness.available)}
              onClick={() => void save(option)}
              className="min-h-11 min-w-11 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-checked:border-brand aria-checked:bg-brand aria-checked:text-brand-foreground"
            >
              {label}
            </button>
          )
        })}
      </div>
      {!state.readiness.available ? (
        <p role="alert" className="text-xs text-destructive">{PRODUCT_WATCH_COPY.unavailable}</p>
      ) : null}
      {statusLine ? (
        <p className="text-xs text-muted-foreground">{statusLine}</p>
      ) : null}
      {state.watchLastError ? (
        <p role="alert" className="text-xs text-destructive">{state.watchLastError}</p>
      ) : null}
    </div>
  )
}
