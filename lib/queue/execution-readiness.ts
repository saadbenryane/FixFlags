import { readWorkerHeartbeat } from './worker-heartbeat'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import type { ExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { SITE_ASSESSMENT_COPY } from '@/lib/marketing/copy/site-assessment'

/** Refuse new work before quota or persistence. Accepted work keeps its recovery lease. */
export async function requireExecutionReady(scope?: ExecutionSpec['scope']): Promise<void> {
  const heartbeat = await readWorkerHeartbeat().catch(() => null)
  if (!heartbeat?.alive || !heartbeat.browserOk ||
      !heartbeat.workers.some((worker) => worker.queueState === 'idle' || worker.queueState === 'active')) {
    throw new SiteRunRefusal(
      'FixFlags cannot start a check right now. Please try again once the service is ready.',
      503,
      'EXECUTION_UNAVAILABLE',
    )
  }
  if (scope && heartbeat.workers.some(worker => !worker.supportedScopes?.includes(scope))) {
    throw new SiteRunRefusal(SITE_ASSESSMENT_COPY.workerScopeUnavailable, 503, 'EXECUTION_SCOPE_UNAVAILABLE')
  }
}
