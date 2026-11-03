import { getAppUrl } from '@/lib/get-app-url'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { EDITOR_EVIDENCE_COPY } from '@/lib/marketing/copy/verification-evidence'
import { buildSiteRepairHandoff } from '@/lib/sites/repair-brief'
import type { SiteRecord } from '@/lib/sites/types'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { SiteRunRefusal } from './run-refusal'

/** Prepare an owned task without recording a customer action. */
export async function loadSiteFlagCopyTask(site: SiteRecord, flagId: string, expectedPromptHash?: string) {
  if (!site.projectId || !site.userId) throw new SiteRunRefusal('Site not found', 404)
  const flag = await loadSiteFlagDetail(site, flagId)
  if (!flag) throw new SiteRunRefusal('Flag not found', 404)
  const { prompt, promptHash, bundlePrompt, brief } = buildSiteRepairHandoff(site.siteId, flag, getAppUrl(), flagId)
  if (!prompt || !promptHash || !bundlePrompt) throw new SiteRunRefusal(EDITOR_EVIDENCE_COPY.unreadable, 422)
  if (expectedPromptHash && expectedPromptHash !== promptHash)
    throw new SiteRunRefusal(SITE_ACTION_COPY.repairGuidance.changed, 409, 'REPAIR_TASK_CHANGED')
  const definition = brief.repair.readiness === 'ready' ? brief.repair.definition : null
  return { prompt, promptHash, bundlePrompt, sourceFlagId: flag.sourceFlagId ?? flag.id, referenceFlagId: flagId,
    source: { sourceAuditId: flag.sourceAuditId, checkId: flag.checkId, problem: flag.problem, pageUrl: flag.pageUrl },
    revision: { contextHash: brief.contextHash, sourceAuditId: flag.sourceAuditId,
      sourceFlagIds: flag.sourceFlagIds ?? [flag.sourceFlagId ?? flag.id],
      checkId: definition?.checkId ?? flag.checkId, recipeCheckVersion: definition?.recipeCheckVersion ?? null,
      includedObservationCheckVersions: [...new Set((brief.flag.supportingObservations ?? []).flatMap(item => item.checkVersion == null ? [] : [item.checkVersion]))].sort((a, b) => a - b),
      recipeVersion: definition?.recipeVersion ?? null, kind: definition?.kind ?? null } }
}
