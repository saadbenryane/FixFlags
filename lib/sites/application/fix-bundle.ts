import { loadSiteFindings } from '@/lib/sites/flags'
import type { SiteRecord } from '@/lib/sites/types'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { getAppUrl } from '@/lib/get-app-url'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { loadSiteFlagCopyTask } from './flag-copy-task'
import { SiteRunRefusal } from './run-refusal'
import { MAX_REPAIR_TASKS } from '../repair-scope'
import { AGENT_HANDOFF_COPY } from '@/lib/marketing/copy/agent-handoff'

/** Same canonical tasks as individual copying. A URL is a reference, never an access grant. */
export async function loadSiteFixBundle(site: SiteRecord, area?: SiteCardArea, flagIds?: string[]) {
  const selected = flagIds ? new Set(flagIds) : null
  const select = async () => (await loadSiteFindings(site)).flags.filter(flag => (!area || flag.area === area) &&
    (!selected || selected.has(flag.id) || selected.has(flag.sourceFlagId ?? flag.id)))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id))
  const flags = await select()
  if (selected && flags.length !== selected.size) throw new SiteRunRefusal(C.bundleSelectionChanged, 409)
  if (!flags.length) throw new SiteRunRefusal(C.bundleEmpty, 422)
  if (flags.length > MAX_REPAIR_TASKS) throw new SiteRunRefusal(C.bundleTooLarge(MAX_REPAIR_TASKS), 422)
  const tasks: Awaited<ReturnType<typeof loadSiteFlagCopyTask>>[] = []
  for (let offset = 0; offset < flags.length; offset += 4) {
    const batch = flags.slice(offset, offset + 4)
    try { tasks.push(...await Promise.all(batch.map(flag => loadSiteFlagCopyTask(site.siteId, flag.id)))) }
    catch (error) {
      if (error instanceof SiteRunRefusal && error.status === 422) throw new SiteRunRefusal(C.bundleNotReady, 422)
      throw error
    }
  }
  const current = await select()
  const membership = (rows: typeof flags) => rows.map(flag => [flag.id, flag.sourceFlagId ?? flag.id])
  if (JSON.stringify(membership(current)) !== JSON.stringify(membership(flags)))
    throw new SiteRunRefusal(C.bundleChanged, 409)
  for (let offset = 0; offset < tasks.length; offset += 4) {
    await Promise.all(tasks.slice(offset, offset + 4).map(task => loadSiteFlagCopyTask(site.siteId, task.referenceFlagId, task.promptHash)))
  }
  const base = `${getAppUrl().replace(/\/$/, '')}/sites/${encodeURIComponent(site.siteId)}`
  const prompt = [
    `FixFlags repair brief for ${site.canonicalHost}`,
    `Dashboard: ${base}${area ? `?category=${area}` : ''}`,
    `Scope: ${selected ? 'selected Flags' : area ?? 'all open Flags'}. ${C.bundleScope(tasks.length)}.`,
    '', ...C.bundleInstructions.map((line, index) => `${index + 1}. ${line}`),
    AGENT_HANDOFF_COPY.retrieval,
    '', ...tasks.map((task, index) => [
      `TASK ${index + 1} OF ${tasks.length}`,
      flags[index].priorityBand ? `Priority: ${C.priority[flags[index].priorityBand]}` : '',
      `Flag reference: ${base}/flags/${encodeURIComponent(task.referenceFlagId)}`,
      task.bundlePrompt,
    ].join('\n\n')),
  ].join('\n\n')
  return { prompt, tasks: tasks.map(({ sourceFlagId, promptHash, referenceFlagId }) => ({ sourceFlagId, promptHash, referenceFlagId })) }
}
