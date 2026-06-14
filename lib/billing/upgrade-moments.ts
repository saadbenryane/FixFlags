import { UPGRADE_MOMENTS } from '@/lib/marketing/copy'

export type UpgradeMoment =
  | 'audit_limit_reached'
  | 'trial_recheck_available'
  | 'compare_improved'
  | 'compare_flat'
  | 'trial_exhausted'
  | 'share_blocked'
  | 'free_default'
  | 'report_completed'

export interface UpgradeMomentContent {
  headline: string
  body: string
  cta: string
  plan: 'BUILDER' | 'TEAM'
  signUpHref?: string
}

export function getUpgradeMomentContent(
  moment: UpgradeMoment,
  options?: {
    scoreDelta?: number
  }
): UpgradeMomentContent {
  const scoreDelta = options?.scoreDelta ?? 0

  switch (moment) {
    case 'audit_limit_reached':
      return { ...UPGRADE_MOMENTS.audit_limit_reached }
    case 'trial_recheck_available':
      return { ...UPGRADE_MOMENTS.trial_recheck_available }
    case 'compare_improved':
      return {
        headline: UPGRADE_MOMENTS.compare_improved.headline(scoreDelta),
        body: UPGRADE_MOMENTS.compare_improved.body,
        cta: UPGRADE_MOMENTS.compare_improved.cta,
        plan: UPGRADE_MOMENTS.compare_improved.plan,
      }
    case 'compare_flat':
      return { ...UPGRADE_MOMENTS.compare_flat }
    case 'trial_exhausted':
      return { ...UPGRADE_MOMENTS.trial_exhausted }
    case 'share_blocked':
      return { ...UPGRADE_MOMENTS.share_blocked }
    case 'report_completed':
      return { ...UPGRADE_MOMENTS.report_completed }
    case 'free_default':
    default:
      return { ...UPGRADE_MOMENTS.free_default }
  }
}

export function resolveFreeUserUpgradeMoment(options: {
  atAuditLimit: boolean
  canUseFreeRecheck: boolean
  hasUsedFreeRecheck?: boolean
}): UpgradeMoment {
  if (options.atAuditLimit) return 'audit_limit_reached'
  if (options.canUseFreeRecheck) return 'trial_recheck_available'
  if (options.hasUsedFreeRecheck) return 'trial_exhausted'
  return 'free_default'
}

export function resolveCompareUpgradeMoment(
  beforeScore: number | null,
  afterScore: number | null
): UpgradeMoment {
  if (
    beforeScore !== null &&
    afterScore !== null &&
    afterScore > beforeScore
  ) {
    return 'compare_improved'
  }
  return 'compare_flat'
}
