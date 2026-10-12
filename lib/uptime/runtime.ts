import { touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { startUptimeWorker } from './queue'
import { executeUptimeProbe, retainUptimeHistory, scheduleUptimeProbes } from './service'
import { deliverUptimeNotifications } from './alerts'
import { logger } from '@/lib/logger'

/** Independent HTTP work does not depend on browser availability. */
export function startUptimeRuntime() {
  const worker = startUptimeWorker(job => executeUptimeProbe(job))
  let sweeping = false, closed = false, lastRetention = 0
  let pendingSweep: Promise<void> | null = null
  const sweep = async () => {
    if (sweeping || closed) return
    sweeping = true
    try {
      await scheduleUptimeProbes()
      await deliverUptimeNotifications()
      if (Date.now() - lastRetention >= 86400_000) {
        await retainUptimeHistory()
        lastRetention = Date.now()
      }
      await touchWorkerHeartbeat({ uptimeReady: true, lastUptimeSweepAt: new Date().toISOString() })
    } catch (error) {
      logger.error('Uptime maintenance failed', error)
      await touchWorkerHeartbeat({ uptimeReady: false }).catch(heartbeatError => logger.error('Uptime heartbeat failed', heartbeatError))
    }
    finally { sweeping = false }
  }
  const tick = () => { if (!sweeping && !closed) pendingSweep = sweep() }
  const initial = setTimeout(tick, 1000)
  const timer = setInterval(tick, 30_000)
  initial.unref(); timer.unref()
  return {
    close: async () => {
      closed = true
      clearTimeout(initial)
      clearInterval(timer)
      const workerClosed = worker.close()
      await Promise.all([pendingSweep, workerClosed])
      await touchWorkerHeartbeat({ uptimeReady: false }).catch(error => logger.error('Uptime shutdown heartbeat failed', error))
    },
  }
}
