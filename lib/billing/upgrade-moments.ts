import { UPGRADE_MOMENTS } from '@/lib/marketing/copy'

export type UpgradeMoment =
  | 'hidden_findings'
  | 'trial_recheck_available'
  | 'compare_improved'
  | 'compare_flat'
  | 'trial_exhausted'
  | 'share_blocked'
  | 'free_default'

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
    hiddenCount?: number
    scoreDelta?: number
  }
): UpgradeMomentContent {
  const hiddenCount = options?.hiddenCount ?? 0
  const scoreDelta = options?.scoreDelta ?? 0

  switch (moment) {
    case 'hidden_findings':
      return {
        headline: UPGRADE_MOMENTS.hidden_findings.headline(hiddenCount),
        body: UPGRADE_MOMENTS.hidden_findings.body,
        cta: UPGRADE_MOMENTS.hidden_findings.cta,
        plan: UPGRADE_MOMENTS.hidden_findings.plan,
      }
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
    case 'free_default':
    default:
      return { ...UPGRADE_MOMENTS.free_default }
  }
}

export function resolveFreeUserUpgradeMoment(options: {
  hiddenCount: number
  canUseFreeRecheck: boolean
  hasUsedFreeRecheck?: boolean
}): UpgradeMoment {
  if (options.hiddenCount > 0) return 'hidden_findings'
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
