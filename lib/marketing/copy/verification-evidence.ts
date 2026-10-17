/** Missing comparison evidence must never sound like a verified recovery. */
export const VERIFICATION_EVIDENCE_COPY = {
  UNREADABLE_RECHECK: "This recheck's recorded scope could not be read. The original finding remains unverified.",
  UNMEASURED: 'This recommendation has no measurable condition that this recheck can independently verify. Review the new evidence before deciding whether the change addresses it.',
  UNREADABLE: 'The original supporting evidence could not be read. This recheck cannot establish a verified recovery.',
  INCOMPLETE_ORIGINAL: 'The original evidence is missing its recorded source, scope, or check version. This recheck cannot establish a verified recovery.',
  MISSING_CHECK: 'This recheck did not include every check from the original finding. The finding remains unverified.',
  METHOD_CHANGED: 'The check method changed after the original observation. This recheck cannot prove that the original condition is resolved.',
} as const

export const EDITOR_EVIDENCE_COPY = {
  title: 'Recorded supporting observations:',
  page: 'Page', source: 'Source', check: 'Check', version: 'Version', recordedAt: 'Recorded at', evidence: 'Evidence', target: 'Target',
  unknown: 'Not recorded',
  verifyAll: 'Recheck every recorded supporting observation on its original page and device. Missing or unavailable evidence does not establish a passed check.',
  unreadable: 'The recorded supporting evidence could not be read. Recheck the affected page before preparing a fix.',
} as const

export const JOURNEY_ROUTE_COPY = {
  continuationRouteNotSelected: 'No eligible continuation link was selected from the recorded page. This route check did not activate unlinked controls or establish whether another action can continue.',
  contactRouteNotSelected: 'No matching contact or help route was selected from the recorded links. This route check does not establish whether a contact method is available on the page.',
} as const
