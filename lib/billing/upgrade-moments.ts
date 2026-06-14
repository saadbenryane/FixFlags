import { UPGRADE_MOMENTS } from '@/lib/marketing/copy'
import { proUpgradeCta } from '@/lib/billing/plans'

export type UpgradeMoment =
  | 'audit_limit_reached'
  | 'trial_recheck_available'
  | 'compare_improved'
  | 'compare_flat'
  | 'trial_exhausted'
  | 'share_public'
  | 'free_default'
  | 'report_completed'

export interface UpgradeMomentContent {
  headline: string
  body: string
  cta: string
  plan: 'BUILDER' | 'TEAM'
  signUpHref?: string
}

function proMoment(
  base: Omit<UpgradeMomentContent, 'cta'> & { ctaPrefix?: string }
): UpgradeMomentContent {
  return {
    ...base,
    cta: proUpgradeCta(base.ctaPrefix ?? 'Upgrade to Pro'),
  }
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
      return proMoment(UPGRADE_MOMENTS.audit_limit_reached)
    case 'trial_recheck_available':
      return { ...UPGRADE_MOMENTS.trial_recheck_available }
    case 'compare_improved':
      return proMoment({
        headline: UPGRADE_MOMENTS.compare_improved.headline(scoreDelta),
        body: UPGRADE_MOMENTS.compare_improved.body,
        plan: UPGRADE_MOMENTS.compare_improved.plan,
        ctaPrefix: 'Start Pro',
      })
    case 'compare_flat':
      return proMoment(UPGRADE_MOMENTS.compare_flat)
    case 'trial_exhausted':
      return proMoment(UPGRADE_MOMENTS.trial_exhausted)
    case 'share_public':
      return { ...UPGRADE_MOMENTS.share_public }
    case 'report_completed':
      return proMoment(UPGRADE_MOMENTS.report_completed)
    case 'free_default':
    default:
      return proMoment(UPGRADE_MOMENTS.free_default)
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
