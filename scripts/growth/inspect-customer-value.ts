const DAY = 86_400_000
const COHORT_MODES = ['acquisition', 'sites', 'sites28']

function utcDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid UTC day')
  const day = new Date(value + 'T00:00:00.000Z')
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) throw new Error('Invalid UTC day')
  return day
}

function options(args: string[], now: Date) {
  if (args[1] === '--start-window') {
    const [mode, , start, end] = args
    if (args.length !== 4 || ![...COHORT_MODES, 'destination-study'].includes(mode)) throw new Error('Invalid window')
    const since = utcDay(start), startWindowEnd = utcDay(end)
    if (since >= startWindowEnd || startWindowEnd > now || startWindowEnd.getTime() - since.getTime() > 90 * DAY) {
      throw new Error('Invalid window')
    }
    return { mode, since, startWindowEnd }
  }
  const [daysArgument = '30', mode = 'cycles'] = args
  const days = Number(daysArgument)
  if (args.length > 2 || ![...COHORT_MODES, 'cycles', 'outcomes'].includes(mode) || !Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error('Invalid window')
  }
  return { mode, since: new Date(now.getTime() - days * DAY) }
}

/** Local, aggregate-only customer value inspection. No production access or writes. */
async function main() {
  const now = new Date()
  const { mode, ...window } = options(process.argv.slice(2), now)
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Local database required')
  }
  const { PrismaClient } = await import('@prisma/client')
  // The shared application client logs Prisma failures. The inspector must not.
  const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
  try {
    if (mode === 'destination-study') {
      if (!window.startWindowEnd) throw new Error('Fixed window required')
      const { loadDestinationStudyOperationalSnapshot } = await import('@/lib/growth/destination-study-operational')
      const result = await loadDestinationStudyOperationalSnapshot({ ...window, startWindowEnd: window.startWindowEnd, now }, db)
      console.log(JSON.stringify(result, null, 2))
      return
    }
    const load = (mode === 'sites' || mode === 'sites28') ? (await import('@/lib/analytics/site-value-query')).loadSiteValueCohort
      : mode === 'acquisition' ? (await import('@/lib/analytics/acquisition-value-query')).loadAcquisitionValueCohort
      : mode === 'outcomes' ? (await import('@/lib/analytics/outcome-recovery-query')).loadOutcomeRecoveryValue
      : (await import('@/lib/analytics/improvement-value-query')).loadCustomerValueReport
    console.log(JSON.stringify(await load({ ...window, now,
      ...(mode === 'sites28' ? { followupDays: 28 as const, includeNativeOutcomeRecovery: true } : {}) }, db), null, 2))
  } finally { await db.$disconnect() }
}

main().catch(() => {
  // Database exceptions may carry credentials, private queries or source identifiers.
  console.error('Customer value inspection failed. Use loopback PostgreSQL and either <days 1 to 90> <mode> or <acquisition|sites|sites28|destination-study> --start-window <YYYY-MM-DD> <YYYY-MM-DD>. The study requires exactly 28 closed UTC days.')
  process.exitCode = 1
})
