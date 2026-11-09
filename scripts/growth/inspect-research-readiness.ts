import { PrismaClient } from '@prisma/client'
import { RESEARCH_CONSENT_EVENT } from '@/lib/growth/research-consent-contract'
import { inspectResearchReadiness } from '@/lib/growth/research-readiness'

/** Report the known schema boundary without treating missing revisions as defaults. */
async function checkConsentSchema(db: Pick<PrismaClient, '$transaction'>) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const [schema] = await tx.$queryRaw<Array<{ targetRevision: boolean; consentHistory: boolean }>>`
      SELECT EXISTS(SELECT FROM pg_attribute WHERE attrelid = to_regclass('projects')
        AND attname = 'watchTargetRevision' AND NOT attisdropped) AS "targetRevision",
        to_regclass('site_lifecycle_events') IS NOT NULL AS "consentHistory"
    `
    if (schema.targetRevision) return null
    const history = schema.consentHistory ? await tx.$queryRaw<Array<{ present: boolean }>>`
      SELECT EXISTS(SELECT FROM site_lifecycle_events WHERE name = ${RESEARCH_CONSENT_EVENT}) AS present
    ` : []
    return {
      status: 'consent-schema-unavailable', missingPrerequisite: 'projects.watchTargetRevision',
      retainedConsentHistory: history[0] ? (history[0].present ? 'present-unclassified' : 'none-observed') : 'unavailable',
    }
  }, { isolationLevel: 'RepeatableRead' })
}

async function main() {
  const [daysArgument = '60', ...options] = process.argv.slice(2)
  const days = Number(daysArgument)
  if (new Set(options).size !== options.length || options.some(option => !['--recoveries', '--page-response-coverage'].includes(option)) ||
    !Number.isInteger(days) || days < 1 || days > 90) throw new Error('Invalid research window')
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Loopback database required')
  }
  const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
  try {
    const end = new Date()
    const start = new Date(end.getTime() - days * 86_400_000)
    const unavailable = await checkConsentSchema(db)
    if (unavailable) {
      console.log(JSON.stringify({
        version: 1, ...unavailable, observationWindow: { start: start.toISOString(), end: end.toISOString() },
        checkedAt: end.toISOString(), counts: null, databaseWritten: false, publicationApproved: false,
      }, null, 2))
      process.exitCode = 1
      return
    }
    console.log(JSON.stringify(await inspectResearchReadiness({ start, end, includeRecoveries: options.includes('--recoveries'),
      includePageResponseCoverage: options.includes('--page-response-coverage') }, db), null, 2))
  } finally {
    await db.$disconnect()
  }
}

main().catch(() => {
  console.error('Research readiness unavailable. Use a loopback PostgreSQL database, a window of 1 to 90 days and optionally --recoveries or --page-response-coverage. No private record or database error was printed.')
  process.exitCode = 1
})
