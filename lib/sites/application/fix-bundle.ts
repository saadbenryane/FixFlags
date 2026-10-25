import { loadSiteFindings } from '@/lib/sites/flags'
import type { SiteRecord } from '@/lib/sites/types'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { getAppUrl } from '@/lib/get-app-url'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { loadSiteFlagCopyTask } from './flag-copy-task'
import { SiteRunRefusal } from './run-refusal'
import { MAX_REPAIR_TASKS } from '../repair-scope'

/** Same canonical tasks as individual copying. A URL is a reference, never an access grant. */
export async function loadSiteFixBundle(site: SiteRecord, area?: SiteCardArea, flagIds?: string[]) {
  const selected = flagIds ? new Set(flagIds) : null
  const select = async () => (await loadSiteFindings(site)).flags.filter(flag => (!area || flag.area === area) &&
    (!selected || selected.has(flag.id) || selected.has(flag.sourceFlagId ?? flag.id)))
    .sort((a, b) => (a.sourceFlagId ?? a.id).localeCompare(b.sourceFlagId ?? b.id))
  const flags = await select()
  if (selected && flags.length !== selected.size) throw new SiteRunRefusal(C.bundleSelectionChanged, 409)
  if (!flags.length) throw new SiteRunRefusal(C.bundleEmpty, 422)
  if (flags.length > MAX_REPAIR_TASKS) throw new SiteRunRefusal(C.bundleTooLarge, 422)
  const tasks: Awaited<ReturnType<typeof loadSiteFlagCopyTask>>[] = []
  for (let offset = 0; offset < flags.length; offset += 4) {
    const batch = flags.slice(offset, offset + 4)
    try { tasks.push(...await Promise.all(batch.map(flag => loadSiteFlagCopyTask(site.siteId, flag.sourceFlagId ?? flag.id)))) }
    catch (error) {
      if (error instanceof SiteRunRefusal && error.status === 422) throw new SiteRunRefusal(C.bundleNotReady, 422)
      throw error
    }
  }
  const current = await select()
  if (JSON.stringify(current.map(flag => flag.sourceFlagId ?? flag.id)) !== JSON.stringify(flags.map(flag => flag.sourceFlagId ?? flag.id)))
    throw new SiteRunRefusal(C.bundleChanged, 409)
  for (let offset = 0; offset < tasks.length; offset += 4) {
    await Promise.all(tasks.slice(offset, offset + 4).map(task => loadSiteFlagCopyTask(site.siteId, task.sourceFlagId, task.promptHash)))
  }
  const base = `${getAppUrl().replace(/\/$/, '')}/sites/${encodeURIComponent(site.siteId)}`
  const prompt = [
    `FixFlags repair brief for ${site.canonicalHost}`,
    `Dashboard: ${base}${area ? `?category=${area}` : ''}`,
    `Scope: ${selected ? 'selected Flags' : area ?? 'all open Flags'}. ${C.bundleScope(tasks.length)}.`,
    '', ...C.bundleInstructions.map((line, index) => `${index + 1}. ${line}`),
    '', ...tasks.map((task, index) => [
      `TASK ${index + 1} OF ${tasks.length}`,
      flags[index].priorityBand ? `Priority: ${C.priority[flags[index].priorityBand]}` : '',
      `Flag reference: ${base}/flags/${encodeURIComponent(task.sourceFlagId)}`,
      task.prompt,
    ].join('\n\n')),
  ].join('\n\n')
  return { prompt, tasks: tasks.map(({ sourceFlagId, promptHash }) => ({ sourceFlagId, promptHash })) }
}
