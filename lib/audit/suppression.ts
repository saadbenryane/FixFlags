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

// When the consolidated security-headers-missing finding is present, drop
// individual header findings so they do not duplicate the consolidated message.
const CONSOLIDATED_SUPPRESSED_BY = new Set([
  'security-csp-missing',
  'security-hsts-missing',
  'security-hsts-too-short',
  'security-frame-options-missing',
  'security-frame-options-too-permissive',
  'security-content-type-options-missing',
])

/** Drop broader Flags when a more specific sibling checkId is present. */
export function suppressOverlappingFlags(flags: DeterministicFlag[]): DeterministicFlag[] {
  const ids = new Set(flags.map((flag) => flag.checkId))
  const hasConsolidated = ids.has('security-headers-missing')
  return flags.filter((flag) => {
    for (const [broader, specific] of SUPPRESSIONS) {
      if (flag.checkId === broader && ids.has(specific)) return false
    }
    if (hasConsolidated && CONSOLIDATED_SUPPRESSED_BY.has(flag.checkId)) return false
    return true
  })
}
