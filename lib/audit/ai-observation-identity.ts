import { createHash } from 'node:crypto'
import type { EvidenceTarget } from './evidence-targets'
import { mergeSupportingObservations, observationsForFlag } from './flag-observations'

type AiObservation = {
  rubric: string; problem: string; evidence: string; pageUrl?: string | null;
  evidenceTargets?: EvidenceTarget[]; fingerprint?: string | null;
  supportingObservations?: unknown; verificationRule?: string | null;
  supportingReviews?: Array<{ evidence: string }>;
}

/** Fresh admissions use recorded scope and evidence. Historical identities stay intact. */
export function newAiObservationFingerprint(flag: AiObservation): string {
  if (flag.fingerprint) return flag.fingerprint
  const targets = (flag.evidenceTargets ?? []).map(target => ({
    kind: target.kind, device: target.device, selector: target.selector ?? null,
    context: target.context ?? null, text: target.text ?? null, label: target.label,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const payload = JSON.stringify({ source: 'AI', rubric: flag.rubric, problem: flag.problem,
    evidence: flag.evidence, pageUrl: flag.pageUrl ?? null, targets })
  return `ai-observation:v1::${createHash('sha256').update(payload).digest('hex')}`
}

/** Provenance comes from the committed task envelope, never the model response. */
export function admitAiObservation<T extends AiObservation>(flag: T, origin?: {
  auditId: string; taskId: string; collectedAt: string;
}) {
  const custody = origin ? { ...origin, checkVersion: null } : undefined
  const supportingObservations = flag.supportingObservations != null || !flag.supportingReviews?.length
    ? observationsForFlag({ ...flag, source: 'AI' }, custody)
    : mergeSupportingObservations(flag.supportingReviews.map(review => observationsForFlag({
      ...flag, source: 'AI', evidence: review.evidence,
    }, custody)))
  return { ...flag, fingerprint: newAiObservationFingerprint(flag), supportingObservations }
}
