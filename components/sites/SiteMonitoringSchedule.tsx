'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { MONITORING_SCHEDULE_COPY as C } from '@/lib/marketing/copy/monitoring'
import { MonitoringScheduleEditor } from './MonitoringScheduleEditor'
import { fetchSiteAction, readSiteActionResponse, siteActionMessage, SiteActionError } from '@/lib/sites/client-actions'
import { scheduleFromWatch, scheduleInterval, scheduleMilliseconds, type MonitoringSchedule } from '@/lib/sites/monitoring-schedule'
import { watchIntervalSchema, type WatchInterval } from '@/lib/sites/watch-schedule'

const optionsSchema = z.object({ intervals: z.array(watchIntervalSchema) })

export function SiteMonitoringSchedule({ siteId, interval, everyMinutes, onClose, onRefresh }: {
  siteId: string
  interval: WatchInterval | null
  everyMinutes?: number | null
  onClose: () => void
  onRefresh: () => Promise<unknown>
}) {
  const [options, setOptions] = useState<WatchInterval[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  useEffect(() => {
    let active = true
    setOptions(null)
    setLoadError(null)
    void fetchSiteAction(`/api/sites/${siteId}/watch`).then(async response => {
      if (!response.ok) { const body = await readSiteActionResponse(response); throw new SiteActionError(body.error ?? C.loadFailed, response.status) }
      const body = optionsSchema.parse(await response.json())
      if (active) setOptions(body.intervals)
    }).catch(error => { if (active) { setLoadError(siteActionMessage(error)); if (error instanceof SiteActionError && error.status === 401) setAuthRequired(true) } })
    return () => { active = false }
  }, [siteId, reload])

  async function save(schedule: MonitoringSchedule) {
    const nextInterval = scheduleInterval(schedule)
    if (busy || !options || (nextInterval && !options.includes(nextInterval))) return
    setBusy(true)
    setMessage(null)
    setUpgradeRequired(false)
    try {
      const customMinutes = nextInterval === 'custom' && schedule ? scheduleMilliseconds(schedule) / 60_000 : undefined
      const response = await fetchSiteAction(`/api/sites/${siteId}/watch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval: nextInterval, ...(customMinutes !== undefined ? { everyMinutes: customMinutes } : {}) }) })
      const body = await readSiteActionResponse(response)
      setUpgradeRequired(body.code === 'INTERVAL_NOT_ALLOWED')
      if (!response.ok) { setMessage(body.error ?? C.saveFailed); return }
      if (body.interval !== nextInterval || (nextInterval === 'custom' && body.everyMinutes !== customMinutes) || body.code) { setMessage(body.message ?? C.differentSchedule); await onRefresh(); return }
      await onRefresh()
      onClose()
    } catch (error) { setMessage(siteActionMessage(error)); if (error instanceof SiteActionError && error.status === 401) setAuthRequired(true) }
    finally { setBusy(false) }
  }

  return <MonitoringScheduleEditor open onOpenChange={open => { if (!open) onClose() }} schedule={scheduleFromWatch(interval, everyMinutes)} availableIntervals={options ?? []} loading={options === null && !loadError} loadError={loadError} onRetry={() => setReload(value => value + 1)} busy={busy} message={message} upgradeRequired={upgradeRequired} signInHref={authRequired ? `/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}` : undefined} onSave={schedule => void save(schedule)} />
}
