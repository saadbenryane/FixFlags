import { prisma } from '@/lib/db'
import { countMonitoringOperations } from '@/lib/sites/application/monitoring-operations'

/** A current heartbeat cannot establish that saved monitoring work is on time.
 * Bound this diagnostic independently from deployment readiness. */
export async function readMonitoringHealth(now = new Date()) {
  const gaps = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '500ms'")
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '250ms'")
    return countMonitoringOperations(tx, now)
  }, { maxWait: 500, timeout: 3000, isolationLevel: 'RepeatableRead' })
  return { ok: Object.values(gaps).every(count => count === 0), checkedAt: now.toISOString(), ...gaps }
}
