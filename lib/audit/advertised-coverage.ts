import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { PAGE_CHECK_DEFINITIONS } from './checks/definitions'
import { SEARCH_DEFINITIONS } from './search/definitions'
import { taskKindSchema } from './progressive/contracts'

export type CoverageEvaluator = `page:${string}` | `search:${string}` | `task:${string}` | 'provider:analytics' | 'projection:availability'
export type CoverageConfiguration = 'public' | 'pagespeed' | 'search_console' | 'analytics' | 'signup_fixture' | 'availability'
export type AdvertisedCoverage = {
  id: string; evaluators: readonly CoverageEvaluator[]; configuration: CoverageConfiguration;
  extent: 'checked_scope' | 'heuristic' | 'partial'; limitation: string;
  acceptance: {
    applicability: string;
    requiredObservations: readonly string[];
    recovery: 'comparable_observation' | 'advisory_reassessment' | 'provider_reporting_window' | 'authorized_lifecycle' | 'scheduled_transition';
    scenarios: readonly ('working' | 'failing' | 'incomplete' | 'repaired' | 'recurring')[];
    proofEnvironments: readonly ('local_worker' | 'live_provider' | 'live_schedule')[];
  };
}
const scope = 'Applies only to the checked pages and recorded execution, not the entire website.'
const heuristic = 'Observed content or layout signals, not proof of visitor behavior or business impact.'
const lab = 'Requires available PageSpeed evidence. Lab measurements are separate from field data; unavailable metrics remain unknown.'
const provider = 'Requires an authorized property covering the checked scope. Provider reporting time is separate from live collection time.'
const applicability: Record<CoverageConfiguration, string> = {
  public: 'Applicable public-page content and safely observable behavior in the admitted scope.',
  pagespeed: 'Available measurements for the admitted page and device. Missing provider measurements remain incomplete.',
  search_console: 'An authorized matching Search Console property and the recorded provider reporting window.',
  analytics: 'An authorized matching Analytics property and the recorded provider reporting window.',
  signup_fixture: 'A current authorized reversible fixture, demonstrated success condition, and recorded cleanup.',
  availability: 'An owned enabled availability binding and the account-permitted monitoring cadence.',
}

/** Acceptance requirements are obligations, never evidence that a scenario passed. */
function acceptanceFor(id: string, evaluators: readonly CoverageEvaluator[], configuration: CoverageConfiguration,
  extent: AdvertisedCoverage['extent']): AdvertisedCoverage['acceptance'] {
  const scheduled = /^uptime\.(schedule|incidents|history|recovery)$/.test(id)
  const providerWindow = id === 'performance.inp' || configuration === 'search_console' || configuration === 'analytics'
  const lifecycle = configuration === 'signup_fixture'
  return {
    applicability: applicability[configuration],
    requiredObservations: [...new Set(evaluators.flatMap(evaluator => {
      const [kind, module] = evaluator.split(':')
      return kind === 'page' ? PAGE_CHECK_DEFINITIONS[module].requiredEvidence.map(source => `${evaluator}:${source}`)
        : [evaluator + ':recorded-observation']
    }))],
    recovery: scheduled ? 'scheduled_transition' : providerWindow ? 'provider_reporting_window' : lifecycle ? 'authorized_lifecycle'
      : extent === 'heuristic' ? 'advisory_reassessment' : 'comparable_observation',
    scenarios: extent === 'heuristic' ? ['working', 'failing', 'incomplete', 'repaired'] : ['working', 'failing', 'incomplete', 'repaired', 'recurring'],
    proofEnvironments: scheduled ? ['local_worker', 'live_schedule'] : providerWindow || configuration === 'pagespeed' || lifecycle
      ? ['local_worker', 'live_provider'] : ['local_worker'],
  }
}
function entries(ids: readonly string[], evaluators: readonly CoverageEvaluator[], configuration: CoverageConfiguration = 'public',
  extent: AdvertisedCoverage['extent'] = 'checked_scope', limitation = scope): AdvertisedCoverage[] {
  return ids.map(id => ({ id, evaluators, configuration, extent, limitation, acceptance: acceptanceFor(id, evaluators, configuration, extent) }))
}

/** Explicit public responsibilities. This inventory maps execution, not passing verdicts. */
export const ADVERTISED_COVERAGE: readonly AdvertisedCoverage[] = [
  ...entries(['pages.discovery'], ['task:discovery']),
  ...entries(['pages.internal-links'], ['task:discovery', 'page:seo']),
  ...entries(['pages.section-links'], ['page:seo']),
  ...entries(['pages.responses'], ['task:http']),
  ...entries(['pages.pricing-contact', 'pages.action-destinations', 'pages.blank-dead-end', 'pages.loading', 'pages.destination-content', 'pages.promise-consistency'], ['task:flow']),
  ...entries(['conversion.primary-action', 'conversion.mobile-navigation', 'conversion.validation', 'conversion.feedback'], ['task:flow']),
  ...entries(['conversion.checkout-entry'], ['task:flow', 'task:bindings'], 'public', 'checked_scope', 'Public action navigation and configured safe cart/checkout entry only. Payment and purchase submission are not tested.'),
  ...entries(['conversion.action-links'], ['page:auth-checkout']),
  ...entries(['conversion.journey-failures'], ['task:journeys']),
  ...entries(['conversion.overlays', 'conversion.reduced-motion'], ['page:interaction']),
  ...entries(['conversion.loading-feedback', 'conversion.input-zoom', 'conversion.button-placement'], ['page:mobile-ux-quality'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.cta-focus'], ['page:cta-focus'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.value-proposition', 'conversion.audience-language'], ['page:messaging-clarity'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.placeholder-copy'], ['page:slop'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.form-friction'], ['page:conversion-friction'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.contact-privacy'], ['page:trust']),
  ...entries(['conversion.claims'], ['page:trust-psychology'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.hierarchy', 'conversion.density'], ['page:visual-hierarchy'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.visual-consistency'], ['page:visual-polish'], 'public', 'heuristic', heuristic),
  ...entries(['signup.confirmation', 'signup.fixture', 'signup.cleanup'], ['task:bindings'], 'signup_fixture', 'checked_scope', 'Requires a current reversible fixture and authorization. Confirmation is limited to its configured success criterion.'),
  ...entries(['signup.authorization'], ['task:fixture-setup', 'task:bindings'], 'signup_fixture', 'checked_scope', 'Setup runs on the durable task ledger. Authorization requires a recorded successful dry run and cleanup of the exact current fixture version. Real hook and account behavior still requires integration verification.'),
  ...entries(['security.https', 'security.mixed-content'], ['page:security']),
  ...entries(['security.privacy', 'security.contact', 'security.consent'], ['page:trust'], 'public', 'heuristic', 'Published trust signals are not legal-compliance verification.'),
  ...entries(['security.csp', 'security.hsts', 'security.framing', 'security.content-type', 'security.referrer', 'security.cross-origin', 'security.permissions', 'security.cross-domain'], ['page:security-headers'], 'public', 'checked_scope', 'Published response configuration, not penetration testing or comprehensive security assurance.'),
  ...entries(['performance.loading', 'performance.lcp', 'performance.cls', 'performance.inp', 'performance.render-blocking', 'performance.unused-code', 'performance.images'], ['page:performance', 'page:mobile'], 'pagespeed', 'checked_scope', lab),
  ...entries(['performance.slow-visibility', 'performance.blank-delayed'], ['task:slow-replay']),
  ...entries(['performance.destination-loading'], ['task:flow']),
  ...entries(['search.presentation', 'search.headings'], ['search:presentation']),
  ...entries(['search.canonicals'], ['search:canonical']),
  ...entries(['search.indexing'], ['search:indexing']),
  ...entries(['search.robots'], ['search:crawl']),
  ...entries(['search.sitemaps', 'search.links'], ['search:discovery']),
  ...entries(['search.structured-data'], ['search:structured-data'], 'public', 'checked_scope', 'Detected entities and supported feature requirements do not promise Google eligibility or rich-result appearance.'),
  ...entries(['search.open-graph', 'search.favicon'], ['page:metadata']),
  ...entries(['search.preview-image'], ['page:og-image']),
  ...entries(['search.preview-consistency'], ['task:cross-page']),
  ...entries(['search.google-indexing', 'search.google-soft404', 'search.google-declarations', 'search.google-ctr'], ['task:google'], 'search_console', 'checked_scope', provider),
  ...entries(['tracking.page-tags', 'tracking.markup', 'tracking.absence', 'tracking.tools'], ['page:measurement'], 'public', 'checked_scope', 'Markup detection does not verify delivery or provider recording. Captured markup and recognized top-level library transfers and event attempts are observed during page loading and existing public action walks. Recognized event requests are suppressed to avoid audit traffic. Consent, unsupported proxies, later behavior and provider recording remain separate or unknown.'),
  ...entries(['tracking.audience', 'tracking.page-traffic'], ['provider:analytics'], 'analytics', 'checked_scope', provider),
  ...entries(['accessibility.names', 'accessibility.labels', 'accessibility.skip-links', 'accessibility.targets', 'accessibility.alt', 'accessibility.contrast', 'accessibility.language', 'accessibility.structure', 'accessibility.aria', 'accessibility.identifiers', 'accessibility.landmarks', 'accessibility.viewport'], ['page:accessibility'], 'public', 'checked_scope', 'Automated checks cover rendered evidence only; manual and assistive-technology review remain separate.'),
  ...entries(['accessibility.traps'], ['page:keyboard'], 'public', 'checked_scope', 'Bounded page navigation and safely declared menu/dialog opening, arrow navigation, modal boundaries, Escape and restoration are exercised. Other states, nested components, embedded frames and unresolved workflows remain explicit limits.'),
  ...entries(['accessibility.focus'], ['page:keyboard'], 'public', 'partial', 'Actual keyboard focus on the page and safely opened popups is inspected for an outline or computed style change. This does not establish pixel contrast, every custom focus effect, embedded controls, or unopened states.'),
  ...entries(['accessibility.tab-order'], ['page:keyboard'], 'public', 'heuristic', 'Records the exercised Tab sequence and detects positive-tabindex backward jumps. Intended reading order and unopened interaction states require separate review.'),
  ...entries(['uptime.response', 'uptime.errors', 'uptime.provenance'], ['task:bindings'], 'availability'),
  ...entries(['uptime.console'], ['page:console']),
  ...entries(['uptime.schedule', 'uptime.incidents', 'uptime.history', 'uptime.recovery'], ['projection:availability'], 'availability', 'checked_scope', 'Persisted configured availability runs and incident history, not uninterrupted observation between scheduled checks.'),
]

export function validateAdvertisedCoverage(definitions: readonly AdvertisedCoverage[] = ADVERTISED_COVERAGE) {
  const advertised = new Set<string>(HOMEPAGE_CHECK_COVERAGE.areas.flatMap(area => area.groups.flatMap(group => group.items.map(item => item.id))))
  const mapped = new Map<string, AdvertisedCoverage>()
  const search = new Set<string>(SEARCH_DEFINITIONS.map(definition => definition.evaluator))
  for (const definition of definitions) {
    if (mapped.has(definition.id) || !advertised.has(definition.id) || !definition.evaluators.length || !definition.limitation.trim())
      throw new Error('Invalid advertised coverage: ' + definition.id)
    for (const evaluator of definition.evaluators) {
      const [kind, id] = evaluator.split(':')
      const valid = kind === 'page' ? Object.hasOwn(PAGE_CHECK_DEFINITIONS, id)
        : kind === 'search' ? search.has(id) : kind === 'task' ? taskKindSchema.safeParse(id).success
          : evaluator === 'provider:analytics' || evaluator === 'projection:availability'
      if (!valid) throw new Error('Missing coverage evaluator: ' + evaluator)
    }
    const acceptance = definition.acceptance
    const required = acceptanceFor(definition.id, definition.evaluators, definition.configuration, definition.extent)
    if (!acceptance?.applicability.trim() ||
      required.requiredObservations.some(observation => !acceptance.requiredObservations.includes(observation)) ||
      required.scenarios.some(scenario => !acceptance.scenarios.includes(scenario)) ||
      required.proofEnvironments.some(environment => !acceptance.proofEnvironments.includes(environment)) ||
      acceptance.recovery !== required.recovery) throw new Error('Missing acceptance requirements: ' + definition.id)
    mapped.set(definition.id, definition)
  }
  for (const id of advertised) if (!mapped.has(id)) throw new Error('Missing advertised coverage: ' + id)
  return mapped
}

export const ADVERTISED_COVERAGE_REGISTRY = validateAdvertisedCoverage()
