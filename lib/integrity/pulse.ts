import { prisma } from '@/lib/db'
import { openCheckDestination } from '@/lib/audit/open-check'
import { logger } from '@/lib/logger'
import { enqueueIntegrityProbe } from './enqueue'

const LEASE_MS = 5 * 60 * 1000
const PULSE_MS = 15 * 60 * 1000

function pulseFailed(outcome: string, status: number | null): boolean {
  if (outcome === 'timeout' || outcome === 'not_found' || outcome === 'server_error' || outcome === 'blocked') {
    return true
  }
  if (status === 404 || status === 410 || (status != null && status >= 500)) return true
  return false
}

export async function processDueIntegrityPulses(): Promise<{ processed: number; walks: number }> {
  const now = new Date()
  const due = await prisma.revenuePath.findMany({
    where: {
      pulseNextRunAt: { lte: now },
      shop: { uninstalledAt: null },
      OR: [{ pulseLeaseUntil: null }, { pulseLeaseUntil: { lte: now } }],
    },
    take: 40,
    select: { id: true, storefrontUrl: true },
  })

  let processed = 0
  let walks = 0
  for (const path of due) {
    const leased = await prisma.revenuePath.updateMany({
      where: {
        id: path.id,
        OR: [{ pulseLeaseUntil: null }, { pulseLeaseUntil: { lte: now } }],
      },
      data: { pulseLeaseUntil: new Date(Date.now() + LEASE_MS) },
    })
    if (leased.count === 0) continue
    processed += 1
    try {
      const result = await openCheckDestination(path.storefrontUrl)
      const failed = pulseFailed(result.outcome, result.status)
      if (failed) {
        await enqueueIntegrityProbe(path.id, 'pulse')
        walks += 1
      }
      await prisma.revenuePath.update({
        where: { id: path.id },
        data: {
          pulseNextRunAt: new Date(Date.now() + PULSE_MS),
          pulseLeaseUntil: null,
        },
      })
    } catch (error) {
      logger.warn('Integrity pulse failed', {
        pathId: path.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { processed, walks }
}
