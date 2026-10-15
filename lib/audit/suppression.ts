import type { DeterministicFlag } from './flag-types'

const SUPPRESSIONS: Array<[string, string]> = [
  ['hierarchy-no-headline', 'h1-missing'],
  ['no-contact-info', 'trust-no-direct-contact'],
  ['hierarchy-competing-actions', 'competing-ctas'],
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

function observationPages(flag: DeterministicFlag): string[] {
  const pages = [...new Set([...(flag.affectedPaths ?? []), ...(flag.pageUrl ? [flag.pageUrl] : [])])]
  return pages.length ? pages : ['']
}

/** Drop broader Flags only when specific evidence covers their affected pages. */
export function suppressOverlappingFlags(flags: DeterministicFlag[]): DeterministicFlag[] {
  const pagesByCheck = new Map<string, Set<string>>()
  for (const flag of flags) {
    const pages = pagesByCheck.get(flag.checkId) ?? new Set<string>()
    for (const page of observationPages(flag)) pages.add(page)
    pagesByCheck.set(flag.checkId, pages)
  }
  return flags.filter((flag) => {
    const pages = observationPages(flag)
    const coveredBy = (checkId: string) => pages.every(page => pagesByCheck.get(checkId)?.has(page))
    for (const [broader, specific] of SUPPRESSIONS) {
      if (flag.checkId === broader && coveredBy(specific)) return false
    }
    if (CONSOLIDATED_SUPPRESSED_BY.has(flag.checkId) && coveredBy('security-headers-missing')) return false
    if (HARDENING_SUPPRESSED_BY.has(flag.checkId) && coveredBy('security-headers-hardening')) return false
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
