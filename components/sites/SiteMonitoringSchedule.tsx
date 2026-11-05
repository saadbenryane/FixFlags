'use client'

import { useEffect, useState } from 'react'
import { MONITORING_SCHEDULE_COPY as C } from '@/lib/marketing/copy/monitoring'
import { MonitoringScheduleEditor } from './MonitoringScheduleEditor'
import { executeSiteAction, siteActionMessage, SiteActionError } from '@/lib/sites/client-actions'
import { useSiteAction } from '@/hooks/useSiteAction'
import { scheduleFromWatch, scheduleInterval, scheduleMilliseconds, type MonitoringSchedule } from '@/lib/sites/monitoring-schedule'
import type { WatchInterval } from '@/lib/sites/watch-schedule'

export function SiteMonitoringSchedule(props: Parameters<typeof SiteMonitoringScheduleContent>[0]) {
  return <SiteMonitoringScheduleContent key={props.siteId} {...props} />
}

function SiteMonitoringScheduleContent({ siteId, interval, everyMinutes, onClose, onRefresh }: {
  siteId: string
  interval: WatchInterval | null
  everyMinutes?: number | null
  onClose: () => void
  onRefresh: () => Promise<unknown>
}) {
  const [options, setOptions] = useState<WatchInterval[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const { busy, message, error, submit, isPending } = useSiteAction({ scope: siteId })
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setOptions(null)
    setLoadError(null)
    void executeSiteAction(`/api/sites/${siteId}/watch`, { signal: controller.signal }, 'watchOptions').then(body => {
      if (active) { setOptions(body.intervals); setAuthRequired(false) }
    }).catch(error => { if (active) { setLoadError(siteActionMessage(error)); if (error instanceof SiteActionError && error.status === 401) setAuthRequired(true) } })
    return () => { active = false; controller.abort() }
  }, [siteId, reload])

  async function save(schedule: MonitoringSchedule) {
    const nextInterval = scheduleInterval(schedule)
    if (isPending() || !options || (nextInterval && !options.includes(nextInterval))) return
    setUpgradeRequired(false)
    const completed = await submit(async signal => {
      const customMinutes = nextInterval === 'custom' && schedule ? scheduleMilliseconds(schedule) / 60_000 : undefined
      const body = await executeSiteAction(`/api/sites/${siteId}/watch`, { signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval: nextInterval, ...(customMinutes !== undefined ? { everyMinutes: customMinutes } : {}) }) }, 'watch')
      return { body, different: body.interval !== nextInterval || (nextInterval === 'custom' && body.everyMinutes !== customMinutes) || Boolean(body.code) }
    }, receipt => {
      setAuthRequired(false)
      setUpgradeRequired(receipt.body.code === 'INTERVAL_NOT_ALLOWED')
      return receipt.different ? receipt.body.message ?? C.differentSchedule : null
    }, onRefresh)
    if (completed.kind === 'saved' && !completed.data.different) onClose()
  }

  return <MonitoringScheduleEditor open onOpenChange={open => { if (!open) onClose() }} schedule={scheduleFromWatch(interval, everyMinutes)} availableIntervals={options ?? []} loading={options === null && !loadError} loadError={loadError} onRetry={() => setReload(value => value + 1)} busy={busy} message={message} upgradeRequired={upgradeRequired || error?.code === 'INTERVAL_NOT_ALLOWED'} signInHref={authRequired || error?.status === 401 ? `/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}` : undefined} onSave={schedule => void save(schedule)} />
}
