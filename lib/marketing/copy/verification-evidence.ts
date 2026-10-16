/** Missing comparison evidence must never sound like a verified recovery. */
export const VERIFICATION_EVIDENCE_COPY = {
  UNREADABLE_RECHECK: "This recheck's recorded scope could not be read. The original finding remains unverified.",
  UNMEASURED: 'This recommendation has no measurable condition that this recheck can independently verify. Review the new evidence before deciding whether the change addresses it.',
  UNREADABLE: 'The original supporting evidence could not be read. This recheck cannot establish a verified recovery.',
  INCOMPLETE_ORIGINAL: 'The original evidence is missing its recorded source, scope, or check version. This recheck cannot establish a verified recovery.',
  MISSING_CHECK: 'This recheck did not include every check from the original finding. The finding remains unverified.',
  METHOD_CHANGED: 'The check method changed after the original observation. This recheck cannot prove that the original condition is resolved.',
} as const
