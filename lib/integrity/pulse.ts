import { prisma } from '@/lib/db'
import { openCheckDestination } from '@/lib/audit/open-check'
import { logger } from '@/lib/logger'
import { enqueueIntegrityProbe } from './enqueue'
import { integrityPathWrite, integrityPathWhere } from './path-authority'

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
      shop: { uninstalledAt: null, encryptedAccessToken: { not: '' } },
      OR: [{ pulseLeaseUntil: null }, { pulseLeaseUntil: { lte: now } }],
    },
    take: 40,
    include: { shop: true },
  })

  let processed = 0
  let walks = 0
  for (const path of due) {
    const leaseUntil = new Date(Date.now() + LEASE_MS)
    const leased = await integrityPathWrite(path, async (tx, current) => {
      const now = new Date()
      if (!current.pulseNextRunAt || current.pulseNextRunAt > now || current.pulseLeaseUntil && current.pulseLeaseUntil > now) return false
      await tx.revenuePath.update({ where: { id: current.id }, data: { pulseLeaseUntil: leaseUntil } })
      return true
    })
    if (!leased) continue
    processed += 1
    try {
      const result = await openCheckDestination(path.storefrontUrl)
      const failed = pulseFailed(result.outcome, result.status)
      const completed = await integrityPathWrite(path, async (tx, current) => {
        if (current.pulseLeaseUntil?.getTime() !== leaseUntil.getTime() ||
          current.lastVerificationRunId !== path.lastVerificationRunId ||
          current.pulseNextRunAt?.getTime() !== path.pulseNextRunAt?.getTime() ||
          current.lastVerifiedAt?.getTime() !== path.lastVerifiedAt?.getTime()) return false
        await tx.revenuePath.update({ where: { id: path.id }, data: {
          pulseNextRunAt: new Date(Date.now() + PULSE_MS), pulseLeaseUntil: null,
        } })
        return true
      })
      if (completed && failed) {
        await enqueueIntegrityProbe(path.id, 'pulse')
        walks += 1
      }
    } catch (error) {
      await prisma.revenuePath.updateMany({ where: { ...integrityPathWhere(path), pulseLeaseUntil: leaseUntil }, data: { pulseLeaseUntil: null } })
      logger.warn('Integrity pulse failed', {
        pathId: path.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { processed, walks }
}
