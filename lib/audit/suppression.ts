import type { DeterministicFlag } from './flag-types'

const SUPPRESSIONS: Array<[string, string]> = [
  ['no-contact-info', 'trust-no-direct-contact'],
  ['hierarchy-competing-actions', 'competing-ctas'],
  ['mobile-load-delay-content', 'loading-state-slow'],
  ['heading-hierarchy-missing', 'hierarchy-no-sections'],
  ['flow-cta-unclickable', 'overlay-blocks-cta'],
  ['flow-pricing-nav-broken', 'overlay-blocks-nav'],
  ['flow-form-no-validation', 'overlay-blocks-form'],
  ['flow-destination-stuck-loading', 'flow-cta-stuck-loading'],
  ['trust-no-authority-signals', 'friction-no-social-proof'],
  ['messaging-no-audience', 'messaging-headline-too-short'],
]

/** Drop broader Flags when a more specific sibling checkId is present. */
export function suppressOverlappingFlags(flags: DeterministicFlag[]): DeterministicFlag[] {
  const ids = new Set(flags.map((flag) => flag.checkId))
  return flags.filter((flag) => {
    for (const [broader, specific] of SUPPRESSIONS) {
      if (flag.checkId === broader && ids.has(specific)) return false
    }
    return true
  })
}
