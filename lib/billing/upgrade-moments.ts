import { UPGRADE_MOMENTS } from '@/lib/marketing/copy'
import { proUpgradeCta } from '@/lib/billing/plans'

export type UpgradeMoment =
  | 'audit_limit_reached'
  | 'compare_improved'
  | 'compare_flat'
  | 'export_locked'
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
    case 'compare_improved':
      return proMoment({
        headline: UPGRADE_MOMENTS.compare_improved.headline(scoreDelta),
        body: UPGRADE_MOMENTS.compare_improved.body,
        plan: UPGRADE_MOMENTS.compare_improved.plan,
        ctaPrefix: 'Join Pro waitlist',
      })
    case 'compare_flat':
      return proMoment(UPGRADE_MOMENTS.compare_flat)
    case 'export_locked':
      return { ...UPGRADE_MOMENTS.export_locked }
    case 'report_completed':
      return proMoment(UPGRADE_MOMENTS.report_completed)
    case 'free_default':
    default:
      return proMoment(UPGRADE_MOMENTS.free_default)
  }
}

export function resolveFreeUserUpgradeMoment(options: {
  atAuditLimit: boolean
}): UpgradeMoment {
  if (options.atAuditLimit) return 'audit_limit_reached'
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
