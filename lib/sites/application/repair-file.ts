import { createHash } from 'node:crypto'
import { getAppUrl } from '@/lib/get-app-url'
import { AGENT_HANDOFF_COPY as C } from '@/lib/marketing/copy/agent-handoff'
import { loadSiteFlagDetail } from '../flags'
import { prepareSiteRepairBrief, renderSiteRepairHandoff } from '../repair-brief'
import type { RepairFileRequest, RepairFileTask } from '../repair-file-contract'
import type { SiteRecord } from '../types'
import { loadRepairSelection } from './repair-selection'
import { SiteRunRefusal } from './run-refusal'
import { readSiteEvidence } from './site-evidence-read'

/** Read-only delivery. Retain one complete task at a time and scalar revisions,
 * not the entire export. A failed or cancelled stream has no completion record. */
export async function prepareSiteRepairFile(site: SiteRecord, scope: RepairFileRequest, signal: AbortSignal,
  authorize: () => Promise<void> = () => readSiteEvidence(site, async () => {})) {
  if (!site.projectId || !site.userId) throw new SiteRunRefusal('Site not found', 404)
  const check = async () => { signal.throwIfAborted(); await authorize(); signal.throwIfAborted() }
  const selectedIds = async () => {
    if (scope.kind === 'flag') return [scope.flagId]
    const selected = await loadRepairSelection(site, scope.area, scope.flagIds)
    if (selected.manifestHash !== scope.manifestHash)
      throw new SiteRunRefusal(C.changed, 409, 'REPAIR_MANIFEST_CHANGED')
    return selected.flags.map(flag => flag.id)
  }
  const read = async (id: string, expectedContextHash?: string, expectedPromptHash?: string) => {
    await check()
    const flag = await loadSiteFlagDetail(site, id)
    if (!flag) throw new SiteRunRefusal('Flag not found', 404)
    const prepared = prepareSiteRepairBrief(site.siteId, flag, getAppUrl(), id, expectedContextHash)
    if (expectedPromptHash && renderSiteRepairHandoff(prepared.page()).promptHash !== expectedPromptHash)
      throw new SiteRunRefusal(C.changed, 409, 'REPAIR_TASK_CHANGED')
    signal.throwIfAborted()
    return prepared
  }
  await check()
  const ids = await selectedIds()
  // Refuse an invalid initial revision before sending attachment headers.
  let first: RepairFileTask | null = (await read(ids[0], undefined,
    scope.kind === 'flag' ? scope.expectedPromptHash : undefined)).complete()
  await check()

  async function* contents() {
    const revisions: Array<{ id: string; hash: string }> = []
    const digest = createHash('sha256')
    function* bytes(text: string, taskArray = false) {
      const encoded = Buffer.from(text)
      if (taskArray) digest.update(encoded)
      for (let offset = 0; offset < encoded.length; offset += 64 * 1024) {
        signal.throwIfAborted()
        yield encoded.subarray(offset, offset + 64 * 1024)
      }
    }
    try {
      await check()
      const header = { schemaVersion: 'fixflags.repair-file.v1', siteId: site.siteId, scope,
        instructions: [C.fileContents, ...C.instructions] }
      yield* bytes(JSON.stringify(header).slice(0, -1) + ',"tasks":')
      yield* bytes('[', true)
      for (let index = 0; index < ids.length; index++) {
        const task: RepairFileTask = first ?? (await read(ids[index])).complete()
        first = null
        await check()
        revisions.push({ id: ids[index], hash: task.contextHash })
        if (index) yield* bytes(',', true)
        yield* bytes(JSON.stringify(task), true)
      }
      yield* bytes(']', true)
      // No long transaction spans file delivery. Revalidate every source and
      // the whole selection before declaring this file complete.
      for (const revision of revisions) await read(revision.id, revision.hash)
      await selectedIds()
      await check()
      yield* bytes(',"completion":' + JSON.stringify({ taskCount: ids.length,
        taskArraySha256: digest.digest('hex'), complete: true }) + '}\n')
    } finally { first = null }
  }
  return contents()
}

/** Backpressure and cancellation remain with the response, not a background
 * producer that keeps reading private sources after the consumer disappears. */
export function repairFileStream(iterator: AsyncGenerator<Uint8Array>, cancel: AbortController, signal = cancel.signal) {
  let stopped = false
  let detach = () => {}
  const stop = () => { stopped = true; detach() }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const aborted = () => {
        if (stopped) return
        stop(); controller.error(signal.reason)
        // A consumer stalled by backpressure may never pull again. Release the
        // suspended generator on expiry as well as explicit stream cancellation.
        void iterator.return(undefined).catch(() => {})
      }
      detach = () => signal.removeEventListener('abort', aborted)
      if (signal.aborted) aborted()
      else signal.addEventListener('abort', aborted, { once: true })
    },
    async pull(controller) {
      try {
        const next = await iterator.next()
        if (stopped) return
        if (next.done) { stop(); controller.close() }
        else controller.enqueue(next.value)
      } catch (error) { if (!stopped) { stop(); controller.error(error) } }
    },
    async cancel(reason) { stop(); cancel.abort(reason); await iterator.return(undefined) },
  })
}
