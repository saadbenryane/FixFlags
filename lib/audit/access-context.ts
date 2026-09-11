import {
  resolveReviewCapabilities,
  type ReviewVisibility,
} from '@/lib/auth/review-access-policy'

export type AuditAccessContext = Exclude<ReviewVisibility, 'curated_sample'>

export type ReportChatGateReason = 'sign-in' | 'owner'
export type ReportClaimReason = 'save-report' | 'scan-limit' | 'create-account'

export function resolveReportChatGate(input: {
  accessContext: AuditAccessContext | 'curated_sample' | null
  isLoggedIn: boolean
}): {
  canChat: boolean
  gateReason: ReportChatGateReason
  canClaim: boolean
  claimReason: Exclude<ReportClaimReason, 'scan-limit'>
} {
  const capabilities = resolveReviewCapabilities({
    visibility: input.accessContext ?? 'denied',
    isAuthenticated: input.isLoggedIn,
  })
  if (capabilities.canUseAgent) {
    return {
      canChat: true,
      gateReason: 'owner',
      canClaim: false,
      claimReason: 'create-account',
    }
  }
  if (capabilities.canClaim) {
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
