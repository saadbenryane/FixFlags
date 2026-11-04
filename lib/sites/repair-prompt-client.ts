import type { SiteCardArea } from './card-areas'
import { executeSiteAction, SiteActionError } from './client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { REPORT_COPY } from '@/lib/marketing/copy/report-workspace'
import { CLIENT_REQUEST_TIMEOUT_MS, withClientDeadline } from '@/lib/api/client-request'
import type { z } from 'zod'
import type { repairManifestSchema } from './repair-scope'
import { REPAIR_FILE_TIMEOUT_MS, repairFileHeaderSchema, repairFileCompletionSchema, type RepairFileRequest } from './repair-file-contract'
import { AGENT_HANDOFF_COPY as H } from '@/lib/marketing/copy/agent-handoff'

export type RepairPromptScope = { siteId: string } & (
  | { kind: 'flag'; flagId: string; sourceFlagId?: string }
  | { kind: 'bundle'; area?: SiteCardArea; flagIds?: string[] }
)
export type PreparedRepairPrompt = { prompt: string; tasks: Array<{ sourceFlagId: string; promptHash: string; referenceFlagId?: string }>;
  manifest?: z.infer<typeof repairManifestSchema> }

/** Offer only a completed file. Stream failures, expired authority and cancelled
 * scopes cannot turn a partial body into a successful browser download. */
export async function downloadRepairFile(scope: RepairPromptScope, prepared: PreparedRepairPrompt, signal: AbortSignal) {
  const input: RepairFileRequest = scope.kind === 'flag'
    ? { kind: 'flag', flagId: scope.flagId, expectedPromptHash: prepared.tasks[0].promptHash }
    : { kind: 'bundle', ...(scope.area ? { area: scope.area } : {}), ...(scope.flagIds ? { flagIds: scope.flagIds } : {}),
      manifestHash: prepared.manifest?.hash ?? '' }
  if (scope.kind === 'bundle' && !prepared.manifest) throw new SiteActionError(SITE_ACTION_COPY.invalidResponse)
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(REPAIR_FILE_TIMEOUT_MS)])
  try {
    const response = await fetch(`/api/sites/${encodeURIComponent(scope.siteId)}/fix-prompt?view=file`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: deadline,
    })
    if (!response.ok) {
      const failure = await response.json().catch(() => null)
      throw new SiteActionError(typeof failure?.message === 'string' ? failure.message : typeof failure?.error === 'string' ? failure.error : H.fileFailed, response.status,
        typeof failure?.code === 'string' ? failure.code : undefined)
    }
    if (response.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new SiteActionError(H.fileFailed)
    const file = await response.blob()
    const prefix = await file.slice(0, 64 * 1024).text()
    const boundary = prefix.indexOf(',"tasks":[')
    const header = repairFileHeaderSchema.parse(JSON.parse(prefix.slice(0, boundary) + '}'))
    if (boundary < 0 || header.siteId !== scope.siteId || header.scope.kind !== input.kind ||
      (header.scope.kind === 'flag' && input.kind === 'flag' &&
        (header.scope.flagId !== input.flagId || header.scope.expectedPromptHash !== input.expectedPromptHash)) ||
      (header.scope.kind === 'bundle' && input.kind === 'bundle' &&
        (header.scope.manifestHash !== input.manifestHash || header.scope.area !== input.area ||
          JSON.stringify(header.scope.flagIds) !== JSON.stringify(input.flagIds)))) throw new SiteActionError(H.fileFailed)
    const tail = await file.slice(-256).text()
    const completionStart = tail.lastIndexOf(',"completion":')
    if (completionStart < 0 || !tail.endsWith('}\n')) throw new SiteActionError(H.fileFailed)
    const completion = repairFileCompletionSchema.parse(JSON.parse(tail.slice(completionStart + ',"completion":'.length, -2)))
    if (completion.taskCount !== (scope.kind === 'flag' ? 1 : prepared.manifest!.total)) throw new SiteActionError(H.fileFailed)
    deadline.throwIfAborted()
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    try {
      link.href = url; link.download = 'fixflags-repairs.json'; document.body.append(link); link.click()
    } finally {
      link.remove()
      // Let the browser acquire the Blob before releasing our URL ownership.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (error) { throw error instanceof SiteActionError ? error : new SiteActionError(H.fileFailed) }
}

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
  // Native writes cannot be cancelled. A late acknowledgment must not record
  // a handoff after the customer has been offered manual recovery.
  const confirmed = await withClientDeadline(() => written).catch(() => false)
  if (!confirmed) return { copied: false, prompt: prepared.prompt }
  onCopied?.()

  const failures: unknown[] = []
  const controller = new AbortController()
  const deadline = performance.now() + CLIENT_REQUEST_TIMEOUT_MS
  let expired = false
  const expire = () => { expired = true; controller.abort() }
  const timer = setTimeout(expire, CLIENT_REQUEST_TIMEOUT_MS)
  try {
    for (let offset = 0; offset < prepared.tasks.length; offset += 4) {
      // A delayed timer cannot lend another batch a new recording window.
      if (controller.signal.aborted || performance.now() >= deadline) { expire(); break }
      const results = await Promise.allSettled(prepared.tasks.slice(offset, offset + 4).map(task =>
        executeSiteAction(`/api/sites/${encodeURIComponent(scope.siteId)}/flags/${encodeURIComponent(task.referenceFlagId ?? task.sourceFlagId)}/fix`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'copy', promptHash: task.promptHash }), signal: controller.signal,
        }, 'fixPrompt')))
      for (const result of results) if (result.status === 'rejected') failures.push(result.reason)
    }
  } finally { clearTimeout(timer) }
  if (expired) failures.push(new Error('Repair handoff recording timed out'))
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
