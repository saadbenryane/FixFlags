import { createHash } from 'node:crypto'
import type { EvidenceTarget } from './evidence-targets'
import { observationsForFlag } from './flag-observations'

type AiObservation = {
  rubric: string; problem: string; evidence: string; pageUrl?: string | null;
  evidenceTargets?: EvidenceTarget[]; fingerprint?: string | null;
  supportingObservations?: unknown; verificationRule?: string | null;
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
  return { ...flag, fingerprint: newAiObservationFingerprint(flag),
    supportingObservations: observationsForFlag({ ...flag, source: 'AI' }, origin ? { ...origin, checkVersion: null } : undefined) }
}
