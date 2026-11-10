import { prisma } from '@/lib/db'
import type { SiteLifecycleEventName } from './site-events'

const DAY = 86_400_000
export const SCOREBOARD_WEEKS = 8

export type ScoreboardStage = 'checks' | 'claimed' | 'fixHandoffs' | 'rechecks' | 'verifiedFixes' | 'watchEnabled'

export type ScoreboardWeek = { weekStart: string } & Record<ScoreboardStage, number>

type ScoreboardEvent = { name: string; createdAt: Date; properties: unknown }

const STAGE_EVENTS: Record<ScoreboardStage, SiteLifecycleEventName> = {
  checks: 'analyze_started',
  claimed: 'site_claimed',
  fixHandoffs: 'fix_handoff',
  rechecks: 'verify_started',
  verifiedFixes: 'verify_result',
  watchEnabled: 'watch_enabled',
}

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStartUtc(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const sinceMonday = (day.getUTCDay() + 6) % 7
  return new Date(day.getTime() - sinceMonday * DAY)
}

function property(properties: unknown, key: string): unknown {
  return properties && typeof properties === 'object' ? (properties as Record<string, unknown>)[key] : undefined
}

function stageFor(event: ScoreboardEvent): ScoreboardStage | null {
  switch (event.name) {
    // Only first checks count; rechecks and scheduled runs are later stages.
    case 'analyze_started': {
      // Events before `firstCheck` existed used the lowercase default trigger only for first checks.
      const first = property(event.properties, 'firstCheck')
      return first === true || (first === undefined && property(event.properties, 'trigger') === 'manual') ? 'checks' : null
    }
    // The North Star: an independent recheck confirmed the change.
    case 'verify_result': return property(event.properties, 'outcome') === 'IMPROVED' ? 'verifiedFixes' : null
    default: {
      const stage = (Object.keys(STAGE_EVENTS) as ScoreboardStage[]).find(key => STAGE_EVENTS[key] === event.name)
      return stage && stage !== 'checks' && stage !== 'verifiedFixes' ? stage : null
    }
  }
}

/** Weekly counts for the Monday review, newest week first. The current week is partial. */
export function calculateWeeklyScoreboard(events: ScoreboardEvent[], asOf: Date, weeks = SCOREBOARD_WEEKS): ScoreboardWeek[] {
  const current = weekStartUtc(asOf).getTime()
  const rows = Array.from({ length: weeks }, (_, index): ScoreboardWeek => ({
    weekStart: new Date(current - index * 7 * DAY).toISOString().slice(0, 10),
    checks: 0, claimed: 0, fixHandoffs: 0, rechecks: 0, verifiedFixes: 0, watchEnabled: 0,
  }))
  for (const event of events) {
    const stage = stageFor(event)
    if (!stage) continue
    const index = Math.round((current - weekStartUtc(event.createdAt).getTime()) / (7 * DAY))
    if (index < 0 || index >= weeks) continue
    rows[index][stage] += 1
  }
  return rows
}

export async function loadWeeklyScoreboard(asOf = new Date()): Promise<ScoreboardWeek[]> {
  const since = new Date(weekStartUtc(asOf).getTime() - (SCOREBOARD_WEEKS - 1) * 7 * DAY)
  const events = await prisma.siteLifecycleEvent.findMany({
    where: { createdAt: { gte: since }, name: { in: Object.values(STAGE_EVENTS) } },
    select: { name: true, createdAt: true, properties: true },
  })
  return calculateWeeklyScoreboard(events, asOf)
}
