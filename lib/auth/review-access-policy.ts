export type ReviewVisibility =
  | 'owner'
  | 'anonymous_teaser'
  | 'public_viewer'
  | 'share_grant'
  | 'curated_sample'
  | 'denied'

export interface ReviewCapabilities {
  visibility: ReviewVisibility
  canViewEvidence: boolean
  canViewPromptBodies: boolean
  canUseAgent: boolean
  canClaim: boolean
  canRunUpdateReview: boolean
  canMutateLifecycle: boolean
  canViewPrivateProductContext: boolean
  canExport: boolean
}

/** Pure report-compatibility projection. Safe to use in client bundles. */
export function resolveReviewCapabilities(input: {
  visibility: ReviewVisibility
  isAuthenticated: boolean
}): ReviewCapabilities {
  const owner = input.visibility === 'owner'
  const curatedSample = input.visibility === 'curated_sample'
  const denied = input.visibility === 'denied'
  return {
    visibility: input.visibility,
    canViewEvidence: !denied,
    canViewPromptBodies: owner || curatedSample,
    canUseAgent: owner,
    canClaim:
      !input.isAuthenticated &&
      (input.visibility === 'anonymous_teaser' ||
        input.visibility === 'public_viewer' ||
        curatedSample),
    canRunUpdateReview: owner,
    canMutateLifecycle: owner,
    canViewPrivateProductContext: owner,
    canExport: owner,
  }
}
