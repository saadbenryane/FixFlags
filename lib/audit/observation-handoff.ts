import { readSupportingObservationView } from './flag-observations'
import { EDITOR_EVIDENCE_COPY as E } from '@/lib/marketing/copy/verification-evidence'

/** One public evidence format for workspace and editor handoffs. */
export function supportingObservationLines(value: unknown): string[] {
  const observations = readSupportingObservationView(value)
  if (!observations?.length) return []
  return ['', E.title, ...observations.flatMap((item, index) => [
    `${index + 1}. ${E.page}: ${item.pageUrl ?? E.unknown}`,
    `   ${E.source}: ${item.source ?? E.unknown}. ${E.check}: ${item.checkId ?? E.unknown}. ${E.version}: ${item.checkVersion ?? E.unknown}.`,
    `   ${E.recordedAt}: ${item.recordedAt ?? E.unknown}`,
    `   ${E.evidence}: ${item.evidence}`,
    ...item.references.map(target => `   ${E.target}: ${target.device}, ${target.label}${target.selector ? ` (${target.selector})` : ''}`),
  ])]
}

