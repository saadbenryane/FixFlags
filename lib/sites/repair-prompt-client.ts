import type { SiteCardArea } from './card-areas'
import { executeSiteAction, SiteActionError } from './client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { REPORT_COPY } from '@/lib/marketing/copy/report-workspace'

export type RepairPromptScope = { siteId: string } & (
  | { kind: 'flag'; flagId: string }
  | { kind: 'bundle'; area?: SiteCardArea; flagIds?: string[] }
)
export type PreparedRepairPrompt = { prompt: string; tasks: Array<{ sourceFlagId: string; promptHash: string }> }

export async function prepareRepairPrompt(scope: RepairPromptScope, signal: AbortSignal): Promise<PreparedRepairPrompt> {
  if (scope.kind === 'flag') {
    const task = await executeSiteAction(`/api/sites/${encodeURIComponent(scope.siteId)}/flags/${encodeURIComponent(scope.flagId)}/fix`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare' }), signal,
    }, 'fixPromptPreparation')
    return { prompt: task.prompt, tasks: [{ sourceFlagId: task.sourceFlagId, promptHash: task.promptHash }] }
  }
  return executeSiteAction(`/api/sites/${encodeURIComponent(scope.siteId)}/fix-prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(scope.area ? { area: scope.area } : {}), ...(scope.flagIds ? { flagIds: scope.flagIds } : {}) }), signal,
  }, 'fixBundle')
}

/** Record the exact prepared tasks only after their physical clipboard write. */
export async function copyRepairPrompt(scope: RepairPromptScope, prepared: PreparedRepairPrompt): Promise<boolean> {
  try { await navigator.clipboard.writeText(prepared.prompt) }
  catch { return false }

  const failures: unknown[] = []
  for (let offset = 0; offset < prepared.tasks.length; offset += 4) {
    const results = await Promise.allSettled(prepared.tasks.slice(offset, offset + 4).map(task =>
      executeSiteAction(`/api/sites/${encodeURIComponent(scope.siteId)}/flags/${encodeURIComponent(task.sourceFlagId)}/fix`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy', promptHash: task.promptHash }),
      }, 'fixPrompt')))
    for (const result of results) if (result.status === 'rejected') failures.push(result.reason)
  }
  if (failures.length) {
    if (scope.kind === 'bundle') throw new SiteActionError(SITE_DASHBOARD_COPY.bundleRecordFailed)
    const failure = failures[0]
    const message = failure instanceof SiteActionError && failure.code === 'REPAIR_TASK_CHANGED'
      ? `${REPORT_COPY.explorer.promptCopiedRecordFailed}. ${SITE_ACTION_COPY.repairGuidance.changed}`
      : REPORT_COPY.explorer.promptCopiedRecordFailed
    throw new SiteActionError(message,
      failure instanceof SiteActionError ? failure.status : undefined,
      failure instanceof SiteActionError ? failure.code : undefined)
  }
  return true
}
