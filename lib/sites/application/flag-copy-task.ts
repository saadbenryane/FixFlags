import { getAppUrl } from '@/lib/get-app-url'
import { hasRepairGuidance } from '@/lib/improvements/repair-guidance'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { EDITOR_EVIDENCE_COPY } from '@/lib/marketing/copy/verification-evidence'
import { buildSiteRepairHandoff } from '@/lib/sites/repair-brief'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { SiteRunRefusal } from './run-refusal'

/** Prepare an owned task without recording a customer action. */
export async function loadSiteFlagCopyTask(siteId: string, flagId: string, expectedPromptHash?: string, expectedSourceFlagId?: string) {
  const site = await loadSiteRecord(siteId)
  const flag = site ? await loadSiteFlagDetail(site, flagId) : null
  if (!flag) throw new SiteRunRefusal('Flag not found', 404)
  if (expectedSourceFlagId && expectedSourceFlagId !== (flag.sourceFlagId ?? flag.id))
    throw new SiteRunRefusal(SITE_ACTION_COPY.repairGuidance.changed, 409, 'REPAIR_TASK_CHANGED')
  if (flag.supportingEvidenceUnreadable) throw new SiteRunRefusal(EDITOR_EVIDENCE_COPY.unreadable, 422)
  if (!hasRepairGuidance(flag.fix)) throw new SiteRunRefusal(
    SITE_ACTION_COPY.repairGuidance[flag.repairGuidance === 'pending' ? 'pending' : 'unavailable'], 422)
  const { prompt, promptHash, bundlePrompt } = buildSiteRepairHandoff(siteId, flag, getAppUrl(), flagId)
  if (!prompt || !promptHash || !bundlePrompt) throw new SiteRunRefusal(EDITOR_EVIDENCE_COPY.unreadable, 422)
  if (expectedPromptHash && expectedPromptHash !== promptHash)
    throw new SiteRunRefusal(SITE_ACTION_COPY.repairGuidance.changed, 409, 'REPAIR_TASK_CHANGED')
  return { prompt, promptHash, bundlePrompt, sourceFlagId: flag.sourceFlagId ?? flag.id, referenceFlagId: flagId }
}
