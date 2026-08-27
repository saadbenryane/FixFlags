import type { DeterministicFlag } from './flag-types'

const SUPPRESSIONS: Array<[string, string]> = [
  ['no-contact-info', 'trust-no-direct-contact'],
  ['hierarchy-competing-actions', 'competing-ctas'],
  ['mobile-load-delay-content', 'loading-state-slow'],
  ['slow-3g-cta-delayed', 'slow-3g-blank-screen'],
  ['perf-score-poor', 'cls-critical'],
  ['perf-score-critical', 'cls-critical'],
  ['heading-hierarchy-missing', 'hierarchy-no-sections'],
  ['heading-order-skipped', 'hierarchy-no-sections'],
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

const HARDENING_SUPPRESSED_BY = new Set([
  'security-csp-unsafe-inline',
  'security-csp-unsafe-eval',
  'security-csp-weak-object-src',
  'security-csp-report-only',
  'security-hsts-no-subdomains',
  'security-hsts-no-preload',
  'security-referrer-policy-missing',
  'security-referrer-policy-weak',
  'security-coop-missing',
  'security-coep-missing',
  'security-corp-missing',
  'security-permissions-policy-missing',
  'security-permissions-policy-overbroad',
  'security-x-permitted-cross-domain',
])

/** Drop broader Flags when a more specific sibling checkId is present. */
export function suppressOverlappingFlags(flags: DeterministicFlag[]): DeterministicFlag[] {
  const ids = new Set(flags.map((flag) => flag.checkId))
  const hasConsolidated = ids.has('security-headers-missing')
  const hasHardening = ids.has('security-headers-hardening')
  return flags.filter((flag) => {
    for (const [broader, specific] of SUPPRESSIONS) {
      if (flag.checkId === broader && ids.has(specific)) return false
    }
    if (hasConsolidated && CONSOLIDATED_SUPPRESSED_BY.has(flag.checkId)) return false
    if (hasHardening && HARDENING_SUPPRESSED_BY.has(flag.checkId)) return false
    return true
  })
}

const PAGE_ROLE_SUPPRESSIONS: Record<string, Set<string>> = {
  'secondary-cta': new Set(['messaging-no-audience']),
  trust: new Set([
    'messaging-headline-too-short',
    'messaging-no-audience',
    'heading-hierarchy-missing',
    'heading-order-skipped',
    'hierarchy-no-sections',
    'friction-no-commitment-path',
  ]),
}

/** Remove landing-page heuristics that are not valid for a page's known role. */
export function suppressFlagsForPageRole(
  flags: DeterministicFlag[],
  role: string
): DeterministicFlag[] {
  const suppressed = PAGE_ROLE_SUPPRESSIONS[role]
  if (!suppressed) return flags
  return flags.filter((flag) => !suppressed.has(flag.checkId))
}
