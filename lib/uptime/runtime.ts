import { touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { startUptimeWorker } from './queue'
import { executeUptimeProbe, retainUptimeHistory, scheduleUptimeProbes } from './service'
import { deliverUptimeNotifications } from './alerts'
import { logger } from '@/lib/logger'
import { createTimerScheduler } from '@/lib/queue/timer-scheduler'

/** Independent HTTP work does not depend on browser availability. */
export function startUptimeRuntime() {
  const worker = startUptimeWorker(job => executeUptimeProbe(job))
  const scheduler = createTimerScheduler(error => logger.error('Uptime maintenance failed', error))
  let lastRetention = 0
  async function scheduling() {
    try {
      await scheduleUptimeProbes()
      await touchWorkerHeartbeat({ uptimeReady: true, lastUptimeSweepAt: new Date().toISOString() })
    } catch (error) {
      logger.error('Uptime scheduling maintenance failed', error)
      await touchWorkerHeartbeat({ uptimeReady: false }).catch(heartbeatError => logger.error('Uptime heartbeat failed', heartbeatError))
    }
  }
  const notifications = () => deliverUptimeNotifications()
  async function retention() {
    if (Date.now() - lastRetention < 86400_000) return
    await retainUptimeHistory()
    lastRetention = Date.now()
  }
  for (const task of [scheduling, notifications, retention]) {
    scheduler.schedule(task, 1000)
    scheduler.schedule(task, 30_000, true)
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
