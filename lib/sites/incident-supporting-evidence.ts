import { hasUnreadableStoredSupportingObservations, publicSupportingObservations,
  type SupportingObservationView } from '@/lib/audit/flag-observations'
import { parseEvidenceTargets } from '@/lib/audit/evidence-targets'

type CapturedFlag = { id: string; auditId: string; source?: string | null; checkId: string | null;
  pageUrl: string | null; evidence: string; evidenceTargets?: unknown; supportingObservations?: unknown }

/** An incident retains each unresolved capture. Missing historical collection
 * versions and timestamps stay unknown; current registry state cannot supply them. */
export function incidentSupportingEvidence(flags: CapturedFlag[]) {
  let unreadable = false
  const observations: SupportingObservationView[] = []
  for (const flag of flags) {
    if (hasUnreadableStoredSupportingObservations(flag.supportingObservations)) { unreadable = true; continue }
    const recorded = flag.supportingObservations == null ? [{ source: flag.source ?? null, checkId: flag.checkId,
      checkVersion: null, pageUrl: flag.pageUrl, evidence: flag.evidence, recordedAt: null,
      references: parseEvidenceTargets(flag.evidenceTargets).map(({ device, label, selector }) => ({ device, label, selector })) }]
      : publicSupportingObservations(flag.supportingObservations)
    observations.push(...recorded.map(item => ({ ...item, sourceFlagId: flag.id,
      sourceAuditId: 'sourceAuditId' in item && typeof item.sourceAuditId === 'string' ? item.sourceAuditId : flag.auditId })))
  }
  // The public contract cannot represent an oversized or malformed group as complete.
  if (observations.length > 5000) unreadable = true
  return { observations: unreadable ? [] : observations, unreadable }
}
