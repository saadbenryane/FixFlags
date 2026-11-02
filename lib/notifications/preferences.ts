import { z } from 'zod'

export const notificationPreferencesSchema = z.object({
  cadence: z.enum(['FOLLOW_MONITORING', 'DAILY', 'WEEKLY', 'OFF']),
  hour: z.number().int().min(0).max(23),
  timeZone: z.string().min(1).max(100).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true }
    catch { return false }
  }),
  weekday: z.number().int().min(0).max(6),
  productTips: z.boolean(),
}).strict()

export const notificationPreferencesPatchSchema = notificationPreferencesSchema.partial().strict()
  .refine(value => Object.keys(value).length > 0)

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>
export function readNotificationPreferences(value: { cadence: string; hour: number; timeZone: string; weekday: number; productTips?: boolean }): NotificationPreferences {
  const { cadence, hour, timeZone, weekday, productTips = false } = value
  return notificationPreferencesSchema.parse({ cadence, hour, timeZone, weekday, productTips })
}
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  cadence: 'FOLLOW_MONITORING', hour: 9, timeZone: 'UTC', weekday: 1, productTips: false,
}
export type MonitoredSite = { watchInterval: string | null; watchEveryMinutes: number | null }

export function summaryCadence(preferences: NotificationPreferences, sites: MonitoredSite[]): 'DAILY' | 'WEEKLY' | null {
  if (preferences.cadence === 'OFF' || !sites.length) return null
  if (preferences.cadence !== 'FOLLOW_MONITORING') return preferences.cadence
  return sites.some(site => ['DAILY', 'HOURLY'].includes(site.watchInterval ?? '') ||
    site.watchInterval === 'CUSTOM' && site.watchEveryMinutes != null && site.watchEveryMinutes <= 1440) ? 'DAILY' : 'WEEKLY'
}

/** Choose one local calendar slot, including across clock changes. A repeated
 * hour has one slot; a skipped hour moves to the next available whole hour. */
export function nextSummaryAt(preferences: NotificationPreferences, cadence: 'DAILY' | 'WEEKLY' | null, after: Date): Date | null {
  if (!cadence) return null
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: preferences.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const parts = (date: Date) => Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, Number(part.value)]))
  const today = parts(after)
  for (let i = 0; i < 9; i++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i))
    if (cadence === 'WEEKLY' && day.getUTCDay() !== preferences.weekday) continue
    const noon = new Date(day.getTime() + 12 * 3600_000), local = parts(noon)
    const offset = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - noon.getTime()
    const guess = day.getTime() + preferences.hour * 3600_000 - offset
    const candidates: Array<{ date: Date; hour: number }> = []
    for (let delta = -180; delta <= 180; delta += 15) {
      const date = new Date(guess + delta * 60_000), p = parts(date)
      if (p.year === day.getUTCFullYear() && p.month === day.getUTCMonth() + 1 && p.day === day.getUTCDate() &&
          p.minute === 0 && p.hour >= preferences.hour) candidates.push({ date, hour: p.hour })
    }
    candidates.sort((a, b) => a.hour - b.hour || a.date.getTime() - b.date.getTime())
    if (candidates[0]?.date > after) return candidates[0].date
  }
  throw new Error('Could not determine the next summary time')
}
