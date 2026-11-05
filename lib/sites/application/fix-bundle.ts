import type { SiteRecord } from '@/lib/sites/types'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { getAppUrl } from '@/lib/get-app-url'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { loadSiteFlagCopyTask } from './flag-copy-task'
import { SiteRunRefusal } from './run-refusal'
import { REPAIR_TASKS_PER_PAGE } from '../repair-scope'
import { loadRepairSelection } from './repair-selection'
import { MAX_REPAIR_BUNDLE_BYTES } from '../repair-budgets'
import { AGENT_HANDOFF_COPY } from '@/lib/marketing/copy/agent-handoff'

/** Same canonical tasks as individual copying. A URL is a reference, never an access grant. */
export async function loadSiteFixBundle(site: SiteRecord, area?: SiteCardArea, flagIds?: string[], page: { offset?: number; manifestHash?: string } = {}) {
  const selected = flagIds ? new Set(flagIds) : null
  const { flags, manifestHash } = await loadRepairSelection(site, area, flagIds)
  const offset = page.offset ?? 0
  if (!Number.isInteger(offset) || offset < 0 || offset >= flags.length || offset > 0 && !page.manifestHash)
    throw new SiteRunRefusal(AGENT_HANDOFF_COPY.invalidContinuation, 400)
  if (page.manifestHash && page.manifestHash !== manifestHash) throw new SiteRunRefusal(C.bundleChanged, 409, 'REPAIR_MANIFEST_CHANGED')
  const pageFlags = flags.slice(offset, offset + REPAIR_TASKS_PER_PAGE)
  const tasks: Awaited<ReturnType<typeof loadSiteFlagCopyTask>>[] = []
  for (let offset = 0; offset < pageFlags.length; offset += 4) {
    const batch = pageFlags.slice(offset, offset + 4)
    try { tasks.push(...await Promise.all(batch.map(flag => loadSiteFlagCopyTask(site, flag.id)))) }
    catch (error) {
      if (error instanceof SiteRunRefusal && error.status === 422) throw new SiteRunRefusal(C.bundleNotReady, 422)
      throw error
    }
  }
  const current = await loadRepairSelection(site, area, flagIds)
  if (current.manifestHash !== manifestHash)
    throw new SiteRunRefusal(C.bundleChanged, 409)
  for (let offset = 0; offset < tasks.length; offset += 4) {
    await Promise.all(tasks.slice(offset, offset + 4).map(task => loadSiteFlagCopyTask(site, task.referenceFlagId, task.promptHash)))
  }
  const base = `${getAppUrl().replace(/\/$/, '')}/sites/${encodeURIComponent(site.siteId)}`
  const render = () => {
    const nextOffset = offset + tasks.length < flags.length ? offset + tasks.length : null
    const continuation = nextOffset === null ? null : {
      method: 'POST' as const, url: `${getAppUrl().replace(/\/$/, '')}/api/sites/${encodeURIComponent(site.siteId)}/fix-prompt`,
      body: { ...(area ? { area } : {}), ...(flagIds ? { flagIds } : {}), manifestHash, offset: nextOffset },
    }
    const prompt = [
      `FixFlags repair brief for ${site.canonicalHost}`,
      `Dashboard: ${base}${area ? `?category=${area}` : ''}`,
      `Scope: ${selected ? 'selected Flags' : area ?? 'all open Flags'}. ${C.bundleScope(flags.length)}.`,
      AGENT_HANDOFF_COPY.scopeRevision(manifestHash, offset, tasks.length, flags.length),
      continuation ? AGENT_HANDOFF_COPY.scopeContinuation(JSON.stringify(continuation)) : '',
      '', ...C.bundleInstructions.map((line, index) => `${index + 1}. ${line}`),
      AGENT_HANDOFF_COPY.retrieval,
      '', ...tasks.map((task, index) => [
        `TASK ${offset + index + 1} OF ${flags.length}`,
        pageFlags[index].priorityBand ? `Priority: ${C.priority[pageFlags[index].priorityBand]}` : '',
        `Flag reference: ${base}/flags/${encodeURIComponent(task.referenceFlagId)}`,
        task.bundlePrompt,
      ].join('\n\n')),
    ].join('\n\n')
    return { prompt, continuation }
  }
  let rendered = render()
  while (Buffer.byteLength(rendered.prompt) > MAX_REPAIR_BUNDLE_BYTES && tasks.length > 1) {
    tasks.pop()
    rendered = render()
  }
  if (Buffer.byteLength(rendered.prompt) > MAX_REPAIR_BUNDLE_BYTES)
    throw new SiteRunRefusal(AGENT_HANDOFF_COPY.bundleTooLarge, 422, 'REPAIR_CONTEXT_TOO_LARGE')
  return { prompt: rendered.prompt, manifest: { schemaVersion: 'fixflags.repair-manifest.v1' as const, hash: manifestHash, total: flags.length, offset, returned: tasks.length, next: rendered.continuation }, tasks: tasks.map(({ sourceFlagId, promptHash, referenceFlagId }) => ({ sourceFlagId, promptHash, referenceFlagId })) }
}
