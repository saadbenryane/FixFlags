import { loadMonitoringOperations } from '@/lib/sites/application/monitoring-operations'

/** A current heartbeat cannot establish that saved monitoring work is on time.
 * Bound this diagnostic independently from deployment readiness. */
export async function readMonitoringHealth(now = new Date()) {
  const gaps = await loadMonitoringOperations(now)
  return { ok: Object.values(gaps).every(count => count === 0), checkedAt: now.toISOString(), ...gaps }
}
