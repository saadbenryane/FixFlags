import { loadSiteFindings, loadSiteResolvedFlags, type SiteFlagDetail } from '../flags'
import type { SiteFlagSeed } from '../coverage'
import type { SiteRecord } from '../types'
import type { ChatFlagContext, ChatImprovementContext, WorkspaceChatInput } from '@/lib/workspace/chat'
import { readSiteEvidence } from './site-evidence-read'
import { loadUptimeStatus } from '@/lib/uptime/queries'
import { uptimeAssessment } from '@/lib/uptime/status'

/** Conversation uses the same current attention, source scope, repair task and
 * recovery proof as the Site. Workflow labels cannot certify a finding. */
export async function loadSiteAgentContext(site: SiteRecord, selected?: SiteFlagDetail | null) {
  return readSiteEvidence(site, async () => {
    const now = new Date()
    const [findings, recovered, status] = selected ? [{ flags: [selected] }, [], undefined] : await Promise.all([
      loadSiteFindings(site), loadSiteResolvedFlags(site), loadUptimeStatus(site, now),
    ])
    const current = findings.flags
    const currentIds = new Set(current.map(flag => flag.sourceFlagId ?? flag.id))
    const currentIncidents = new Set(current.flatMap(flag => flag.improvementId ? [flag.improvementId] : []))
    // A prior recovery must not answer for a current recurrence of that same
    // incident. Its exact historical Flag remains independently accessible.
    const history = recovered.filter(flag => !currentIds.has(flag.sourceFlagId ?? flag.id) &&
      (!flag.improvementId || !currentIncidents.has(flag.improvementId)))
    const flags: ChatFlagContext[] = [...current, ...history].map((flag, position) => ({
      id: selected ? flag.sourceFlagId ?? flag.id : flag.id,
      sourceFlagId: flag.sourceFlagId ?? flag.id,
      checkId: flag.checkId, rubric: flag.rubric, severity: flag.severity,
      problem: flag.problem, evidence: flag.evidence, fix: flag.fix,
      status: flag.verificationState === 'verified' ? 'FIXED' : flag.status,
      verificationState: flag.verificationState, priorityScore: flag.priorityScore,
      latestOccurrenceAt: flag.latestOccurrenceAt, pageUrl: flag.pageUrl, position,
    }))
    const improvements: ChatImprovementContext[] = current.filter(flag => flag.improvementId && flag.verificationState !== 'verified').map(repairContext)
    const findingScope: NonNullable<WorkspaceChatInput['findingScope']> = { kind: selected ? 'flag' : 'site',
      currentCount: current.filter(flag => flag.verificationState !== 'verified').length,
      recentRecoveryCount: history.length + current.filter(flag => flag.verificationState === 'verified').length }
    const uptime = status === undefined ? undefined : status ? { status, assessment: uptimeAssessment(status, now) } : null
    return { flags, improvements, findingScope, uptime }
  })
}

function repairContext(flag: SiteFlagSeed): ChatImprovementContext {
  return { id: flag.id, title: flag.problem, judgment: flag.whyItMatters,
    recommendedChange: flag.fix, successCondition: flag.repairDefinition?.acceptance.join('\n') ?? '',
    status: flag.status, verificationState: flag.verificationState }
}
