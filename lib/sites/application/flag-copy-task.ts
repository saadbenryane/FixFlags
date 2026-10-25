import { getAppUrl } from '@/lib/get-app-url'
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
  const recordedTask = boardFlagPrompt({
    problem: flag.problem, whyItMatters: flag.whyItMatters,
    evidence: flag.evidenceMissing ? null : flag.evidence,
    fix: flag.fix, pageUrl: flag.pageUrl, affectedPaths: flag.affectedPaths,
    journeyName: flag.relatedOutcome?.name, expectedBehavior: flag.expectedBehavior,
    supportingObservations: flag.supportingObservations,
  })
  if (!recordedTask) throw new SiteRunRefusal(EDITOR_EVIDENCE_COPY.unreadable, 422)
  const base = getAppUrl().replace(/\/$/, '')
  const reference = flag.sourceAuditId ? [
    `Recorded scan: ${base}/report/${encodeURIComponent(flag.sourceAuditId)}`,
    `Agent-readable scan JSON: ${base}/api/reports/${encodeURIComponent(flag.sourceAuditId)}`,
    'Read the recorded scan for context. Access follows the scan visibility. If it is unavailable, use the recorded task below.',
  ] : []
  const prompt = [...reference, recordedTask].join('\n\n')
  const promptHash = createHash('sha256').update(prompt).digest('hex')
  if (expectedPromptHash && expectedPromptHash !== promptHash)
    throw new SiteRunRefusal(SITE_ACTION_COPY.repairGuidance.changed, 409, 'REPAIR_TASK_CHANGED')
  return { prompt, promptHash, sourceFlagId: flag.sourceFlagId ?? flag.id }
}
