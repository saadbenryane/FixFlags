'use client'

import { useState } from 'react'
import { MONITORING_SCHEDULE_COPY as C } from '@/lib/marketing/copy/monitoring'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from './ResponsiveDepth'
import { scheduleInterval, scheduleLabel, type MonitoringSchedule } from '@/lib/sites/monitoring-schedule'
import type { WatchInterval } from '@/lib/sites/watch-schedule'
import { SCAN_LIMIT_GATE } from '@/lib/marketing/copy'

type Choice = 'daily' | 'hourly' | 'weekly' | 'custom' | 'off'

export function MonitoringScheduleEditor({ open, onOpenChange, schedule, availableIntervals, loading = false, loadError, onRetry, busy = false, message, sample = false, upgradeRequired = false, signInHref, onSave }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: MonitoringSchedule
  availableIntervals: readonly WatchInterval[]
  loading?: boolean
  loadError?: string | null
  onRetry?: () => void
  busy?: boolean
  message?: string | null
  sample?: boolean
  upgradeRequired?: boolean
  signInHref?: string
  onSave: (schedule: MonitoringSchedule) => void
}) {
  const [choice, setChoice] = useState<Choice>(() => schedule ? schedule.every === 1 ? { hours: 'hourly', days: 'daily', weeks: 'weekly' }[schedule.unit] as Choice : 'custom' : 'off')
  const [every, setEvery] = useState(String(schedule?.every ?? 3))
  const [unit, setUnit] = useState<'hours' | 'days' | 'weeks'>(schedule?.unit ?? 'hours')
  const selected: MonitoringSchedule = choice === 'off' ? null : choice === 'custom' ? { every: Number(every), unit } : { every: 1, unit: choice === 'daily' ? 'days' : choice === 'weekly' ? 'weeks' : 'hours' }
  const valid = !selected || (Number.isInteger(selected.every) && selected.every >= 1 && selected.every <= 365)
  const interval = scheduleInterval(selected)
  const supported = sample || interval === null || availableIntervals.includes(interval)

  return <ResponsiveDepth open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
    <DialogTitle>{C.title}</DialogTitle>
    <DialogDescription>{C.description}</DialogDescription>
    {sample ? <p className="text-sm text-muted-foreground">{C.sample}</p> : null}
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (valid && supported && !busy && !loading && !loadError) onSave(selected) }}>
      <label className="grid gap-2 text-sm font-medium">{C.frequency}
        <select className="min-h-11 rounded-control border border-border bg-background px-3" value={choice} disabled={busy || loading || Boolean(loadError)} onChange={event => setChoice(event.target.value as Choice)}>
          <option value="daily">{C.daily}</option>
          <option value="hourly">{C.hourly}</option>
          <option value="weekly">{C.weekly}</option>
          <option value="custom">{C.custom}</option>
          <option value="off">{C.off}</option>
        </select>
      </label>
      {choice === 'custom' ? <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-2 text-sm font-medium">{C.every}
          <input type="number" min={1} max={365} step={1} className="min-h-11 w-full rounded-control border border-border bg-background px-3" value={every} disabled={busy} onChange={event => setEvery(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">{C.unit}
          <select className="min-h-11 rounded-control border border-border bg-background px-3" value={unit} disabled={busy} onChange={event => setUnit(event.target.value as typeof unit)}>
            <option value="hours">{C.hours}</option><option value="days">{C.days}</option><option value="weeks">{C.weeks}</option>
          </select>
        </label>
      </div> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{C.loading}</p> : loadError ? <div role="status"><p className="text-sm">{loadError}</p><Button type="button" variant="outline" className="mt-2" onClick={onRetry}>{C.retry}</Button></div> : !valid ? <p role="status" className="text-sm">{C.invalid}</p> : !supported ? <p role="status" className="text-sm text-muted-foreground">{C.unavailable}</p> : <p className="text-sm text-muted-foreground">{selected ? C.checks(scheduleLabel(selected)) : C.paused}</p>}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {!sample && (!supported || upgradeRequired) ? <Button asChild variant="outline"><a href="/pricing">{SCAN_LIMIT_GATE.upgrade.secondaryCta}</a></Button> : null}
      {signInHref ? <Button asChild variant="outline"><a href={signInHref}>{C.signIn}</a></Button> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{C.cancel}</Button>
        <Button type="submit" variant="brand" disabled={busy || loading || Boolean(loadError) || !valid || !supported}>{busy ? C.saving : sample ? C.updateSample : C.save}</Button>
      </div>
    </form>
  </ResponsiveDepth>
}
