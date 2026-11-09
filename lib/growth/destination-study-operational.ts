import type { PrismaClient } from '@prisma/client'
import { readAcquisitionValueCohort } from '@/lib/analytics/acquisition-value-query'
import { readSiteValueCohort } from '@/lib/analytics/site-value-query'
import { destinationStudyOperationalSnapshot } from './destination-study-readout'

const DAY = 86_400_000

export async function loadDestinationStudyOperationalSnapshot(
  window: { since: Date; startWindowEnd: Date; now: Date },
  db: Pick<PrismaClient, '$transaction'>,
) {
  if (window.startWindowEnd.getTime() - window.since.getTime() !== 28 * DAY ||
    window.since.getTime() % DAY !== 0 || window.startWindowEnd > window.now) {
    throw new Error('The destination study needs 28 closed UTC days')
  }
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const acquisition = await readAcquisitionValueCohort(tx, window)
    const sites = await readSiteValueCohort(tx, { ...window, followupDays: 28, includeNativeOutcomeRecovery: true })
    return destinationStudyOperationalSnapshot(acquisition, sites)
  }, { isolationLevel: 'RepeatableRead' })
}
