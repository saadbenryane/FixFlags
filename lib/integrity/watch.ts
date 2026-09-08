import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { enqueueIntegrityProbe } from './enqueue'
import { processDueIntegrityPulses } from './pulse'

const LEASE_MS = 10 * 60 * 1000

export async function processDueIntegrityWatches(): Promise<{ processed: number }> {
  const now = new Date()
  const due = await prisma.revenuePath.findMany({
    where: {
      watchNextRunAt: { lte: now },
      shop: { uninstalledAt: null },
      OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lte: now } }],
    },
    take: 20,
    select: { id: true },
  })

  let processed = 0
  for (const path of due) {
    const leased = await prisma.revenuePath.updateMany({
      where: {
        id: path.id,
        OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lte: now } }],
      },
      data: { watchLeaseUntil: new Date(Date.now() + LEASE_MS) },
    })
    if (leased.count === 0) continue
    try {
      await enqueueIntegrityProbe(path.id, 'schedule')
      processed += 1
    } catch (error) {
      logger.warn('Integrity watch enqueue failed', {
        pathId: path.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { processed }
}

export async function processIntegrityMaintenance(): Promise<{
  walks: number
  pulses: number
  pulseWalks: number
}> {
  const walks = await processDueIntegrityWatches()
  const pulses = await processDueIntegrityPulses()
  return { walks: walks.processed, pulses: pulses.processed, pulseWalks: pulses.walks }
}
