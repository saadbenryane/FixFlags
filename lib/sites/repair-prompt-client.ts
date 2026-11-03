import type { SiteCardArea } from './card-areas'
import { executeSiteAction, SiteActionError } from './client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { REPORT_COPY } from '@/lib/marketing/copy/report-workspace'

export type RepairPromptScope = { siteId: string } & (
  | { kind: 'flag'; flagId: string; sourceFlagId?: string }
  | { kind: 'bundle'; area?: SiteCardArea; flagIds?: string[] }
)
export type PreparedRepairPrompt = { prompt: string; tasks: Array<{ sourceFlagId: string; promptHash: string; referenceFlagId?: string }> }

export async function prepareRepairPrompt(scope: RepairPromptScope, signal: AbortSignal): Promise<PreparedRepairPrompt> {
  if (scope.kind === 'flag') {
    const task = await executeSiteAction(`/api/sites/${encodeURIComponent(scope.siteId)}/flags/${encodeURIComponent(scope.flagId)}/fix`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prepare', ...(scope.sourceFlagId ? { expectedSourceFlagId: scope.sourceFlagId } : {}) }), signal,
    }, 'fixPromptPreparation')
    return { prompt: task.prompt, tasks: [{ sourceFlagId: task.sourceFlagId, promptHash: task.promptHash, referenceFlagId: task.referenceFlagId }] }
  }
  return executeSiteAction(`/api/sites/${encodeURIComponent(scope.siteId)}/fix-prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(scope.area ? { area: scope.area } : {}), ...(scope.flagIds ? { flagIds: scope.flagIds } : {}) }), signal,
  }, 'fixBundle')
}

/** Record the exact prepared tasks only after their physical clipboard write. */
export async function copyRepairPrompt(scope: RepairPromptScope, preparation: PreparedRepairPrompt | Promise<PreparedRepairPrompt>, onCopied?: () => void): Promise<
  { copied: false; prompt: string } | { copied: true; recording: 'recorded' | 'failed'; notice: string | null }> {
  const pending = Promise.resolve(preparation)
  // Start the native write inside the click gesture. WebKit accepts a promised
  // Blob while preparation is in flight, without losing that activation.
  let write: Promise<void>
  try {
    write = typeof navigator.clipboard?.write === 'function' && typeof ClipboardItem !== 'undefined'
      ? navigator.clipboard.write([new ClipboardItem({ 'text/plain': pending.then(task =>
        new Blob([task.prompt], { type: 'text/plain' })) })])
      : pending.then(task => navigator.clipboard.writeText(task.prompt))
  } catch (error) { write = Promise.reject(error) }
  const written = write.then(() => true, () => false)
  const prepared = await pending
  if (!await written) return { copied: false, prompt: prepared.prompt }
  onCopied?.()

  const failures: unknown[] = []
  for (let offset = 0; offset < prepared.tasks.length; offset += 4) {
    const results = await Promise.allSettled(prepared.tasks.slice(offset, offset + 4).map(task =>
      executeSiteAction(`/api/sites/${encodeURIComponent(scope.siteId)}/flags/${encodeURIComponent(task.referenceFlagId ?? task.sourceFlagId)}/fix`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy', promptHash: task.promptHash }),
      }, 'fixPrompt')))
    for (const result of results) if (result.status === 'rejected') failures.push(result.reason)
  }
  if (failures.length) {
    if (scope.kind === 'bundle') return { copied: true, recording: 'failed', notice: SITE_DASHBOARD_COPY.bundleRecordFailed }
    const failure = failures[0]
    const message = failure instanceof SiteActionError && failure.code === 'REPAIR_TASK_CHANGED'
      ? `${REPORT_COPY.explorer.promptCopiedRecordFailed}. ${SITE_ACTION_COPY.repairGuidance.changed}`
      : REPORT_COPY.explorer.promptCopiedRecordFailed
    return { copied: true, recording: 'failed', notice: message }
  }
  return { copied: true, recording: 'recorded', notice: null }
}
