import { readWorkerHeartbeat } from './worker-heartbeat'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

/** Refuse new work before quota or persistence. Accepted work keeps its recovery lease. */
export async function requireExecutionReady(): Promise<void> {
  const heartbeat = await readWorkerHeartbeat().catch(() => null)
  if (!heartbeat?.alive || !heartbeat.browserOk ||
      !heartbeat.workers.some((worker) => worker.queueState === 'idle' || worker.queueState === 'active')) {
    throw new SiteRunRefusal(
      'FixFlags cannot start a check right now. Please try again once the service is ready.',
      503,
      'EXECUTION_UNAVAILABLE',
    )
  }
}
