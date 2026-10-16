import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { enqueueIntegrityProbe } from './enqueue'
import { processDueIntegrityPulses } from './pulse'
import { integrityPathWrite, integrityPathWhere } from './path-authority'

const LEASE_MS = 10 * 60 * 1000

export async function processDueIntegrityWatches(): Promise<{ processed: number }> {
  const now = new Date()
  const due = await prisma.revenuePath.findMany({
    where: {
      watchNextRunAt: { lte: now },
      shop: { uninstalledAt: null, encryptedAccessToken: { not: '' } },
      OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lte: now } }],
    },
    take: 20,
    include: { shop: true },
  })

  let processed = 0
  for (const path of due) {
    const leaseUntil = new Date(Date.now() + LEASE_MS)
    const leased = await integrityPathWrite(path, async (tx, current) => {
      const now = new Date()
      if (!current.watchNextRunAt || current.watchNextRunAt > now || current.watchLeaseUntil && current.watchLeaseUntil > now) return false
      await tx.revenuePath.update({ where: { id: current.id }, data: { watchLeaseUntil: leaseUntil } })
      return true
    })
    if (!leased) continue
    try {
      await enqueueIntegrityProbe(path.id, 'schedule')
      processed += 1
    } catch (error) {
      await prisma.revenuePath.updateMany({ where: { ...integrityPathWhere(path), watchLeaseUntil: leaseUntil }, data: { watchLeaseUntil: null } })
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
