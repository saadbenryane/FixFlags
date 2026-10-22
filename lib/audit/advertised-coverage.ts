import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { PAGE_CHECK_DEFINITIONS } from './checks/definitions'
import { SEARCH_DEFINITIONS } from './search/definitions'
import { taskKindSchema } from './progressive/contracts'

export type CoverageEvaluator = `page:${string}` | `search:${string}` | `task:${string}` | 'provider:analytics' | 'projection:availability' | 'projection:uptime'
export type CoverageConfiguration = 'public' | 'pagespeed' | 'search_console' | 'analytics' | 'signup_fixture' | 'availability' | 'automatic_accounts' | 'uptime_probes'
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
const lab = 'Requires available PageSpeed evidence. Lab measurements are separate from field data; unavailable metrics remain unknown. Repairs require the original page, destination, engine and measurement profile. Resource repairs also retain the original provider audits, device, units and thresholds. Changed or unrecorded conditions remain unverified.'
const provider = 'Requires an authorized property covering the checked scope. Provider reporting time is separate from live collection time.'
const applicability: Record<CoverageConfiguration, string> = {
  public: 'Applicable public-page content and safely observable behavior in the admitted scope.',
  pagespeed: 'Available measurements for the admitted page and device. Missing provider measurements remain incomplete.',
  search_console: 'An authorized matching Search Console property and the recorded provider reporting window.',
  analytics: 'An authorized matching Analytics property and the recorded provider reporting window.',
  signup_fixture: 'A current authorized reversible fixture, demonstrated success condition, and recorded cleanup.',
  availability: 'An owned enabled availability binding and the account-permitted monitoring cadence.',
  automatic_accounts: 'An owned private Site, enabled preference, verified mailbox infrastructure and supported same-origin account lifecycle.',
  uptime_probes: 'An owned Site with monitoring enabled, its current public URL generation and recorded five-minute HTTP observations.',
}

/** Acceptance requirements are obligations, never evidence that a scenario passed. */
function acceptanceFor(id: string, evaluators: readonly CoverageEvaluator[], configuration: CoverageConfiguration,
  extent: AdvertisedCoverage['extent']): AdvertisedCoverage['acceptance'] {
  const scheduled = /^uptime\.(schedule|incidents|history|recovery)$/.test(id)
  const providerWindow = id === 'performance.inp' || configuration === 'search_console' || configuration === 'analytics'
  const lifecycle = configuration === 'signup_fixture' || configuration === 'automatic_accounts'
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
  ...entries(['pages.section-links'], ['page:seo'], 'public', 'checked_scope',
    'Exact fragment targets in the active captured document, excluding template and noscript descendants. Inactive links cannot invent failures or certify repair. Historical detector scopes remain distinct; custom routing, text fragments, later states and click or scroll behavior remain separate or unknown.'),
  ...entries(['pages.responses'], ['page:page-response']),
  ...entries(['pages.pricing-contact'], ['task:flow'], 'public', 'checked_scope',
    'Public primary-action navigation and an independent rendered header pricing observation. Pricing repair and Watch recovery retain the original control, page, capture and access identity. Hidden copies are excluded; missing or changed controls, restrictions, blank destinations, pending responses and unclassified redirects cannot certify repair. This does not establish purchase or contact submission.'),
  ...entries(['pages.action-destinations', 'pages.blank-dead-end', 'pages.loading', 'pages.destination-content', 'pages.promise-consistency'], ['task:flow']),
  ...entries(['conversion.primary-action', 'conversion.validation', 'conversion.feedback'], ['task:flow']),
  ...entries(['conversion.mobile-navigation'], ['task:flow'], 'public', 'checked_scope',
    'An independent 375px mobile browser observation checks bounded navigation panels, missing or disabled controls and declared menu opening, including existing and dynamically mounted portals. Repair retains the original navigation links and capture conditions. Links are observed for visibility, never followed. Unsupported controls, missing original links, embedded content and incomplete execution remain unknown.'),
  ...entries(['conversion.checkout-entry'], ['task:flow', 'task:bindings'], 'public', 'checked_scope', 'Public action navigation and configured safe cart/checkout entry only. Payment and purchase submission are not tested.'),
  ...entries(['conversion.action-links'], ['page:auth-checkout'], 'public', 'checked_scope',
    'Bounded public GET observations of sign-in and payment destinations declared in the active rendered document. Inactive noscript and template controls cannot consume the live action inventory. Access restrictions, transport failures and untested links remain unknown; successful GET does not establish login or payment completion.'),
  ...entries(['conversion.journey-failures'], ['task:journeys'], 'public', 'checked_scope',
    'Native first-visit, pricing and signup page conditions record headline, rendered action, eligible path and signup field observations. Bounded discovery preserves the selected control; incomplete absence stays unknown. Repair compares every original page, control, route, phase, access and capture profile, with detector corrections distinguished from repairs. Monitoring retains recorded journey types and paths after classification changes. These observations do not establish submission success or visitor behavior; unscoped and heuristic walkthrough findings remain unverified.'),
  ...entries(['conversion.overlays'], ['task:overlays', 'task:flow', 'task:journeys'], 'public', 'checked_scope',
    'Persistent-cover observations on a bounded initial viewport cohort on desktop and mobile, plus recorded flow, pricing navigation, form validation and journey interactions. Repair requires the original control, page, browser conditions and phase. After-action recovery requires completed activation. Legacy findings without original scope and unsupported controls remain unverified.'),
  ...entries(['conversion.reduced-motion'], ['page:interaction', 'task:motion'], 'public', 'checked_scope',
    'Paired initial normal and reduced-preference observations cover changing CSS, transition and Animation API effects in the top document. Each moving element counts once per family. Canvas, SVG SMIL, requestAnimationFrame drawing, embedded documents and later interactions remain separate or unverified.'),
  ...entries(['conversion.loading-feedback', 'conversion.input-zoom', 'conversion.button-placement'], ['page:mobile-ux-quality'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.cta-focus'], ['page:cta-focus'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.value-proposition', 'conversion.audience-language'], ['page:messaging-clarity'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.placeholder-copy'], ['page:slop'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.form-friction'], ['page:conversion-friction'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.contact-privacy'], ['page:trust']),
  ...entries(['conversion.claims'], ['page:trust-psychology'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.hierarchy', 'conversion.density'], ['page:visual-hierarchy'], 'public', 'heuristic', heuristic),
  ...entries(['conversion.visual-consistency'], ['page:visual-polish'], 'public', 'heuristic', heuristic),
  ...entries(['accounts.signup', 'accounts.verification', 'accounts.signed-in', 'accounts.deletion'], ['task:automatic-accounts'], 'automatic_accounts', 'checked_scope', 'Supported same-origin HTTPS account flows only. Unsupported fields, identity providers, CAPTCHA and inconclusive deletion remain unverified.'),
  ...entries(['signup.confirmation', 'signup.fixture', 'signup.cleanup'], ['task:bindings'], 'signup_fixture', 'checked_scope', 'Requires a current reversible fixture and authorization. Confirmation is limited to its configured success criterion.'),
  ...entries(['signup.authorization'], ['task:fixture-setup', 'task:bindings'], 'signup_fixture', 'checked_scope', 'Setup runs on the durable task ledger. Authorization requires a recorded successful dry run and cleanup of the exact current fixture version. Real hook and account behavior still requires integration verification.'),
  ...entries(['security.https', 'security.mixed-content'], ['page:security']),
  ...entries(['security.privacy', 'security.contact', 'security.consent'], ['page:trust'], 'public', 'heuristic', 'Published trust signals are not legal-compliance verification.'),
  ...entries(['security.csp', 'security.hsts', 'security.framing', 'security.content-type', 'security.referrer', 'security.cross-origin', 'security.permissions', 'security.cross-domain'], ['page:security-headers'], 'public', 'checked_scope', 'Published response configuration, not penetration testing or comprehensive security assurance. HSTS requires complete directives and a valid duration; cached or inherited policy and preload enrollment remain separate. MIME protection uses the first field value; referrer checks use the last recognized fallback policy. Cross-origin checks require recognized policy values; explicit permissive declarations cannot certify restrictive repairs or browser isolation. Permissions checks parse sensitive-feature wildcard tokens in the RFC 8941 dictionary; device permission and iframe delegation remain separate. Malformed policies remain unknown. Document and per-request overrides are separate; historical substring observations cannot certify repair.'),
  ...entries(['performance.loading', 'performance.lcp', 'performance.cls', 'performance.inp', 'performance.render-blocking', 'performance.unused-code', 'performance.images'], ['page:performance', 'page:mobile'], 'pagespeed', 'checked_scope', lab),
  ...entries(['performance.slow-visibility', 'performance.blank-delayed'], ['task:slow-replay'], 'public', 'checked_scope',
    'Independent simulated mobile slow-3G observation of viewport content and recognized action timing. Repair retains every original page, final URL, native browser profile, access identity and action scope. Changed conditions, missing controls, sampling gaps and historical unscoped observations cannot certify repair. This does not establish physical-device or field performance.'),
  ...entries(['performance.destination-loading'], ['task:flow'], 'public', 'checked_scope',
    'Bounded native desktop observations measure content delay and persistent blocking loading UI after the original public action. Independent repair and Watch recovery compare the same control, reached URL, capture/access identity and detector. Blank recovery, changed routes, restrictions, incomplete samples and unscoped historical findings remain unknown; this does not establish business completion or later interaction states.'),
  ...entries(['search.presentation', 'search.headings'], ['search:presentation']),
  ...entries(['search.canonicals'], ['search:canonical'], 'public', 'checked_scope',
    'HTML canonical declarations use the active document base, while HTTP Link headers use the response URL. Collection and evaluation share the same parser and bounded rendered sections retain the native base. Historical detector corrections cannot certify repair; missing target responses and incomplete declarations remain unknown.'),
  ...entries(['search.indexing'], ['search:indexing']),
  ...entries(['search.robots'], ['search:crawl']),
  ...entries(['search.sitemaps', 'search.links'], ['search:discovery']),
  ...entries(['search.structured-data'], ['search:structured-data'], 'public', 'checked_scope', 'Detected entities and supported feature requirements do not promise Google eligibility or rich-result appearance.'),
  ...entries(['search.open-graph', 'search.favicon'], ['page:metadata']),
  ...entries(['search.preview-image'], ['page:og-image'], 'public', 'checked_scope',
    'Public GET facts and bounded first-frame PNG, JPEG, WebP and GIF pixel decoding. Original bytes are collected once through the public request boundary and discarded after deriving private response and decoding facts. Decode repair requires the same image destination and decoder policy. Unsupported formats, incomplete bytes and resource or execution limits remain unknown. Platform rendering, caches and later animation frames are separate.'),
  ...entries(['search.preview-consistency'], ['task:cross-page']),
  ...entries(['search.google-indexing', 'search.google-soft404', 'search.google-declarations', 'search.google-ctr'], ['task:google'], 'search_console', 'checked_scope', provider),
  ...entries(['tracking.page-tags', 'tracking.markup', 'tracking.absence', 'tracking.tools'], ['page:measurement'], 'public', 'checked_scope', 'Markup detection does not verify delivery or provider recording. Captured markup and recognized top-level library transfers and event attempts are observed during page loading and existing public action walks. Request URL, method, page, phase and capture identities constrain repair without retaining raw project keys or query values. Historical unscoped evidence cannot certify repair. Recognized event requests are suppressed to avoid audit traffic. Consent, unsupported proxies, later behavior and provider recording remain separate or unknown.'),
  ...entries(['tracking.audience', 'tracking.page-traffic'], ['provider:analytics'], 'analytics', 'checked_scope', provider),
  ...entries(['accessibility.names', 'accessibility.labels', 'accessibility.skip-links', 'accessibility.targets', 'accessibility.alt', 'accessibility.contrast', 'accessibility.language', 'accessibility.structure', 'accessibility.aria', 'accessibility.identifiers', 'accessibility.landmarks', 'accessibility.viewport'], ['page:accessibility'], 'public', 'checked_scope', 'Automated rendered evidence uses the selected WCAG policy, registered heading and landmark best-practice rules, and a legacy control-identifier diagnostic. Native rule findings and comparable repairs survive unavailable whole-document metadata; HTML fallback signals remain unknown. Unresolved results stay unknown; manual and assistive-technology review remain separate.'),
  ...entries(['accessibility.traps'], ['page:keyboard'], 'public', 'checked_scope', 'Bounded page navigation and safely declared menu/dialog opening, arrow navigation, modal boundaries, Escape and restoration are exercised, including inspectable open shadow roots and assigned slots. Closed roots, embedded frames, unopened nested interactions and unresolved workflows remain explicit limits.'),
  ...entries(['accessibility.focus'], ['page:keyboard'], 'public', 'partial', 'Actual keyboard focus on the page, inspectable open shadow roots and safely opened popups is inspected for a focus-specific computed style change. An outline matching a uniform surrounding background is not accepted. Patterned, clipped and unresolved backgrounds remain unknown. This does not establish pixel contrast, every custom focus effect, closed roots, embedded frames, or unopened states.'),
  ...entries(['accessibility.tab-order'], ['page:keyboard'], 'public', 'heuristic', 'Records the exercised Tab sequence and detects positive-tabindex backward jumps. Intended reading order and unopened interaction states require separate review.'),
  ...entries(['uptime.response', 'uptime.errors', 'uptime.provenance'], ['task:bindings', 'projection:uptime'], 'uptime_probes', 'checked_scope', 'Recorded public HTTP observations remain separate from configured rendered-page verification.'),
  ...entries(['uptime.console'], ['page:console']),
  ...entries(['uptime.schedule', 'uptime.incidents', 'uptime.history', 'uptime.recovery'], ['projection:uptime'], 'uptime_probes', 'checked_scope', 'Recorded five-minute public HTTP probes, confirmation and incident history. Missing periods remain unknown; rendered-page verification is separate.'),
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
          : evaluator === 'provider:analytics' || evaluator === 'projection:availability' || evaluator === 'projection:uptime'
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
