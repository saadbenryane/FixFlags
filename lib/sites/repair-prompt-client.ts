import type { SiteCardArea } from './card-areas'
import { executeSiteAction } from './client-actions'

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
