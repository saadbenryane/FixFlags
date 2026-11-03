import { loadSiteFindings } from '@/lib/sites/flags'
import type { SiteRecord } from '@/lib/sites/types'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { getAppUrl } from '@/lib/get-app-url'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { loadSiteFlagCopyTask } from './flag-copy-task'
import { SiteRunRefusal } from './run-refusal'
import { MAX_REPAIR_TASKS, MAX_REPAIR_MANIFEST_TASKS, REPAIR_TASKS_PER_PAGE } from '../repair-scope'
import { createHash } from 'node:crypto'
import { canonicalIntent } from '../domain/execution-spec'
import { MAX_REPAIR_BUNDLE_BYTES } from '../repair-budgets'
import { AGENT_HANDOFF_COPY } from '@/lib/marketing/copy/agent-handoff'

/** Same canonical tasks as individual copying. A URL is a reference, never an access grant. */
export async function loadSiteFixBundle(site: SiteRecord, area?: SiteCardArea, flagIds?: string[], page: { offset?: number; manifestHash?: string } = {}) {
  const selected = flagIds ? new Set(flagIds) : null
  const select = async () => (await loadSiteFindings(site)).flags.filter(flag => (!area || flag.area === area) &&
    (!selected || selected.has(flag.id) || selected.has(flag.sourceFlagId ?? flag.id)))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id))
  const flags = await select()
  if (selected && flags.length !== selected.size) throw new SiteRunRefusal(C.bundleSelectionChanged, 409)
  if (!flags.length) throw new SiteRunRefusal(C.bundleEmpty, 422)
  if (selected && selected.size > MAX_REPAIR_TASKS) throw new SiteRunRefusal(C.bundleTooLarge(MAX_REPAIR_TASKS), 422)
  if (flags.length > MAX_REPAIR_MANIFEST_TASKS) throw new SiteRunRefusal(AGENT_HANDOFF_COPY.manifestTooLarge, 422)
  const revision = (rows: typeof flags) => {
    const digest = createHash('sha256').update('fixflags.repair-manifest.v1')
    for (const flag of rows) digest.update(createHash('sha256').update(canonicalIntent({
      id: flag.id, sourceFlagId: flag.sourceFlagId ?? flag.id, checkId: flag.checkId,
      repairEvidenceRevision: flag.repairEvidenceRevision, definition: flag.repairDefinition,
      problem: flag.problem, evidence: flag.evidence, whyItMatters: flag.whyItMatters, fix: flag.fix,
      pageUrl: flag.pageUrl, affectedPaths: flag.affectedPaths, relatedOutcome: flag.relatedOutcome,
    })).digest())
    return digest.digest('hex')
  }
  const manifestHash = revision(flags)
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
  const current = await select()
  if (revision(current) !== manifestHash)
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
