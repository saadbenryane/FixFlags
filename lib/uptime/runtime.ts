import { touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { startUptimeWorker } from './queue'
import { executeUptimeProbe, retainUptimeHistory, dispatchDueUptimeProbes, initializeUptimeMonitors } from './service'
import { deliverUptimeNotifications } from './alerts'
import { logger } from '@/lib/logger'
import { createTimerScheduler } from '@/lib/queue/timer-scheduler'
import { UPTIME_SWEEP_INTERVAL_MS } from './domain'

/** Independent HTTP work does not depend on browser availability. */
export function startUptimeRuntime() {
  const worker = startUptimeWorker(job => executeUptimeProbe(job))
  const scheduler = createTimerScheduler(error => logger.error('Uptime maintenance failed', error))
  let lastRetention = 0
  async function scheduling() {
    try {
      const { published, failed } = await dispatchDueUptimeProbes()
      if (failed > 0 && published === 0 || !await worker.checkReady()) await touchWorkerHeartbeat({ uptimeReady: false })
      else await touchWorkerHeartbeat({ uptimeReady: true, lastUptimeSweepAt: new Date().toISOString() })
    } catch (error) {
      logger.error('Uptime scheduling maintenance failed', error)
      await touchWorkerHeartbeat({ uptimeReady: false }).catch(heartbeatError => logger.error('Uptime heartbeat failed', heartbeatError))
    }
  }
  const initialization = () => initializeUptimeMonitors()
  const notifications = () => deliverUptimeNotifications()
  async function retention() {
    if (Date.now() - lastRetention < 86400_000) return
    const remaining = await retainUptimeHistory()
    // Keep yielding to the ordinary maintenance cadence while batches or
    // temporarily locked probes remain. Only a drained sweep starts the wait.
    if (!remaining) lastRetention = Date.now()
  }
  for (const task of [initialization, scheduling, notifications, retention]) {
    scheduler.schedule(task, 1000)
    scheduler.schedule(task, UPTIME_SWEEP_INTERVAL_MS, true)
  }
  return {
    waitUntilReady: () => worker.waitUntilReady(),
    close: async () => {
      const pendingMaintenance = scheduler.stop()
      await Promise.all([pendingMaintenance, worker.close(pendingMaintenance)])
      await touchWorkerHeartbeat({ uptimeReady: false }).catch(error => logger.error('Uptime shutdown heartbeat failed', error))
    },
  }
}
