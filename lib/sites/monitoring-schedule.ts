import { MONITORING_SCHEDULE_COPY as C } from '@/lib/marketing/copy/monitoring'
import { watchIntervalMinutes, type WatchInterval } from './watch-schedule'

export type MonitoringSchedule = { every: number; unit: 'hours' | 'days' | 'weeks' } | null

export function scheduleLabel(schedule: MonitoringSchedule): string {
  if (!schedule) return C.off
  if (schedule.every === 1) return { hours: C.hourly, days: C.daily, weeks: C.weekly }[schedule.unit]
  return C.everyInterval(schedule.every, schedule.unit)
}

export function scheduleInterval(schedule: MonitoringSchedule): WatchInterval | null {
  if (!schedule) return null
  if (schedule.unit === 'hours' && schedule.every === 1) return 'hourly'
  if (schedule.unit === 'days' && schedule.every === 1) return 'daily'
  if ((schedule.unit === 'weeks' && schedule.every === 1) || (schedule.unit === 'days' && schedule.every === 7)) return 'weekly'
  return 'custom'
}

export function scheduleFromWatch(interval: WatchInterval | null, everyMinutes?: number | null): MonitoringSchedule {
  if (!interval) return null
  const minutes = watchIntervalMinutes(interval, everyMinutes)
  if (minutes % 10080 === 0) return { every: minutes / 10080, unit: 'weeks' }
  if (minutes % 1440 === 0) return { every: minutes / 1440, unit: 'days' }
  return { every: minutes / 60, unit: 'hours' }
}

export function scheduleMilliseconds(schedule: Exclude<MonitoringSchedule, null>): number {
  return schedule.every * { hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 }[schedule.unit]
}

export function nextCheckLabel(nextRunAt: string | null, now: number): string {
  if (!nextRunAt) return C.notScheduled
  const remaining = new Date(nextRunAt).getTime() - now
  if (!Number.isFinite(remaining)) return C.notScheduled
  if (remaining <= 0) return C.due
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const parts = [days ? `${days} ${days === 1 ? 'day' : 'days'}` : '', hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '', minutes % 60 ? `${minutes % 60} ${minutes % 60 === 1 ? 'minute' : 'minutes'}` : ''].filter(Boolean)
  return C.nextIn(parts.join(' and '))
}

export function nextCheckCompactLabel(nextRunAt: string | null, now: number): string {
  if (!nextRunAt || !Number.isFinite(new Date(nextRunAt).getTime())) return C.noNext
  const remaining = new Date(nextRunAt).getTime() - now
  if (remaining <= 0) return C.nextDue
  const total = Math.ceil(remaining / 60_000)
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const minutes = total % 60
  return C.nextCompact([days ? `${days}d` : '', hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' '))
}
