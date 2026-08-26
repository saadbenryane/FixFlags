export type AuditAccessContext =
  | 'owner'
  | 'anonymous_teaser'
  | 'public_viewer'
  | 'marketing_sample'
  | 'studio_public'
  | 'share_grant'
  | 'denied'

/** Browser-safe chat/claim gate. marketing_sample is curated fixtures only. */

export type ReportChatGateReason = 'sign-in' | 'owner'
export type ReportClaimReason = 'save-report' | 'scan-limit' | 'create-account'

export function resolveReportChatGate(input: {
  accessContext: AuditAccessContext | 'repository_sample' | null
  isLoggedIn: boolean
}): {
  canChat: boolean
  gateReason: ReportChatGateReason
  canClaim: boolean
  claimReason: Exclude<ReportClaimReason, 'scan-limit'>
} {
  if (input.accessContext === 'owner') {
    return {
      canChat: true,
      gateReason: 'owner',
      canClaim: false,
      claimReason: 'create-account',
    }
  }
  if (!input.isLoggedIn) {
    return {
      canChat: false,
      gateReason: 'sign-in',
      canClaim: true,
      claimReason:
        input.accessContext === 'anonymous_teaser' ? 'save-report' : 'create-account',
    }
  }
  return {
    canChat: false,
    gateReason: 'owner',
    canClaim: false,
    claimReason: 'create-account',
  }
}
