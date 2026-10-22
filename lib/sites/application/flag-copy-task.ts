import { createHash } from 'node:crypto'
import { hasRepairGuidance } from '@/lib/improvements/repair-guidance'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { EDITOR_EVIDENCE_COPY } from '@/lib/marketing/copy/verification-evidence'
import { boardFlagPrompt } from '@/lib/sites/board-card'
import { loadSiteBoardFlag } from './queries'
import { SiteRunRefusal } from './run-refusal'

/** Prepare an owned task without recording a customer action. */
export async function loadSiteFlagCopyTask(siteId: string, flagId: string, expectedPromptHash?: string) {
  const detail = await loadSiteBoardFlag(siteId, flagId)
  if (!detail) throw new SiteRunRefusal('Flag not found', 404)
  const { flag } = detail
  if (flag.supportingEvidenceUnreadable) throw new SiteRunRefusal(EDITOR_EVIDENCE_COPY.unreadable, 422)
  if (!hasRepairGuidance(flag.fix)) throw new SiteRunRefusal(
    SITE_ACTION_COPY.repairGuidance[flag.repairGuidance === 'pending' ? 'pending' : 'unavailable'], 422)
  const prompt = boardFlagPrompt({
    problem: flag.problem, whyItMatters: flag.whyItMatters,
    evidence: flag.evidenceMissing ? null : flag.evidence,
    fix: flag.fix, pageUrl: flag.pageUrl, affectedPaths: flag.affectedPaths,
    journeyName: flag.relatedOutcome?.name, expectedBehavior: flag.expectedBehavior,
    supportingObservations: flag.supportingObservations,
  })
  if (!prompt) throw new SiteRunRefusal(EDITOR_EVIDENCE_COPY.unreadable, 422)
  const promptHash = createHash('sha256').update(prompt).digest('hex')
  if (expectedPromptHash && expectedPromptHash !== promptHash)
    throw new SiteRunRefusal(SITE_ACTION_COPY.repairGuidance.changed, 409, 'REPAIR_TASK_CHANGED')
  return { prompt, promptHash, sourceFlagId: flag.sourceFlagId ?? flag.id }
}
