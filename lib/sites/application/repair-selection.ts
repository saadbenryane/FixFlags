import { createHash } from 'node:crypto'
import { loadSiteFindings } from '../flags'
import type { SiteRecord } from '../types'
import type { SiteCardArea } from '../card-areas'
import { canonicalIntent } from '../domain/execution-spec'
import { MAX_REPAIR_TASKS, MAX_REPAIR_MANIFEST_TASKS } from '../repair-scope'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { AGENT_HANDOFF_COPY } from '@/lib/marketing/copy/agent-handoff'
import { SiteRunRefusal } from './run-refusal'

/** Scope and its revision belong to the selection, independent of delivery. */
export async function loadRepairSelection(site: SiteRecord, area?: SiteCardArea, flagIds?: string[]) {
  const selected = flagIds ? new Set(flagIds) : null
  const flags = (await loadSiteFindings(site)).flags.filter(flag => (!area || flag.area === area) &&
    (!selected || selected.has(flag.id) || selected.has(flag.sourceFlagId ?? flag.id)))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id))
  if (selected && flags.length !== selected.size) throw new SiteRunRefusal(C.bundleSelectionChanged, 409)
  if (!flags.length) throw new SiteRunRefusal(C.bundleEmpty, 422)
  if (selected && selected.size > MAX_REPAIR_TASKS) throw new SiteRunRefusal(C.bundleTooLarge(MAX_REPAIR_TASKS), 422)
  if (flags.length > MAX_REPAIR_MANIFEST_TASKS) throw new SiteRunRefusal(AGENT_HANDOFF_COPY.manifestTooLarge, 422)
  const digest = createHash('sha256').update('fixflags.repair-manifest.v1')
  for (const flag of flags) digest.update(createHash('sha256').update(canonicalIntent({
    id: flag.id, sourceFlagId: flag.sourceFlagId ?? flag.id, checkId: flag.checkId,
    repairEvidenceRevision: flag.repairEvidenceRevision, definition: flag.repairDefinition,
    problem: flag.problem, evidence: flag.evidence, whyItMatters: flag.whyItMatters, fix: flag.fix,
    pageUrl: flag.pageUrl, affectedPaths: flag.affectedPaths, relatedOutcome: flag.relatedOutcome,
  })).digest())
  return { flags, manifestHash: digest.digest('hex') }
}
