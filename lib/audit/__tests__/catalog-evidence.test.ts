import { describe, expect, it } from 'vitest'
import { ADVERTISED_COVERAGE, type AdvertisedCoverage } from '../advertised-coverage'
import { document, evidence, markup, PAGE } from '../search/__tests__/fixtures'
import { evaluateSearch, searchFindings } from '../search/registry'
import { assessSearchRecovery } from '../search/recovery'
import { searchReceiptSchema, type SearchObservation } from '../search/contracts'
import { googleIndexObservations } from '../search/google-index'
import { searchAnalyticsObservations } from '../search/google'
import { planReviewTargets, type ReviewPlan } from '../review-depth'
import { normalizeAuditUrl, AuditUrlError } from '../url'
import { parseMetadataFromHtml, type PageMetadata, type RuntimeHeadMetadata } from '../metadata'
import { classifyPublicGet, deadDestinationFlags, type OpenCheckResult } from '../open-check'
import { observationIdentity } from '../flag-identity'
import { PAGE_CHECKS, type PageCheckContext } from '../checks/catalog'
import { checkReceiptSchema } from '../checks/receipt'
import { scopedAssertionForTarget } from '../checks/verification'
import type { CheckAssertion } from '../checks/assertion'
import type { DeterministicFlag } from '../flag-types'
import { assessPageResponse } from '../checks/page-response'
import { publicLinkObservations } from '../checks/public-links'
import { sectionLinkObservations } from '../checks/section-links'
import { securityObservations, runSecurityBasicsChecks } from '../checks/security'
import { securityHeaderObservations, runSecurityHeaderChecks } from '../checks/security-headers'
import { publicTrustObservations, runTrustChecks } from '../checks/trust'
import { consoleObservations, runConsoleChecks } from '../checks/console'
import { runKeyboardChecks } from '../checks/keyboard'
import { keyboardEvidenceSchema, type KeyboardEvidence } from '../browser/keyboard-probe'
import { evaluateAccessibility } from '../checks/accessibility-observations'
import type { AxeViolation } from '../checks/accessibility'
import { runTrackingChecks } from '../checks/tracking'
import type { TrackingEvidence } from '../tracking/contracts'
import { recordCheckObservations } from '../checks/observations'
import { runPerformanceChecks } from '../checks/performance'
import { performanceMeasurement } from '../performance-measurement'
import type { PageSpeedResult } from '../pagespeed'
import type { ResourceAudit } from '../pagespeed-opportunities'
import { runMetadataChecks, runOgImageUrlCheck } from '../checks/metadata-checks'
import { evaluateCorridorConsistency, type CorridorPageMeta } from '../checks/corridor-consistency'
import { actionDestinationObservation } from '../checks/auth-checkout'
import { destinationContentObservations } from '../checks/flow-destination-content'
import type { DestinationUXQuality } from '../flow/destination-ux-probes'
import type { FlowScanResult } from '../flow/run-flow-scan'
import { primaryActionAssertions, primaryControlContext, primaryPageContext, scopePrimaryActionFlags, type PrimaryActionEvidence } from '../flow/primary-action-evidence'
import { pricingNavigationAssertions, type PricingNavigationEvidence } from '../flow/pricing-navigation-evidence'
import { mobileNavigationAssertions, mobileNavigationContext, mobileLinkIdentity, mobileNavigationFlags, type MobileNavigationObservation } from '../flow/mobile-navigation-evidence'
import { postClickAssertions, POST_CLICK_VERIFICATION_RULE, runPostClickFlowChecks, scopePostClickFlags } from '../checks/flow-post-click'
import type { PostClickMetrics } from '../flow/post-click-probes'
import { runFlowChecks } from '../checks/flow'
import { checkFormValidation } from '../checks/form-validation'
import type { FormEvidence } from '../flow/form-evidence'
import { overlayAssertions, overlayControlContext, overlayObservationSchema, runObservedOverlayChecks, overlayCheckReceipts, type OverlayObservation } from '../checks/overlay-evidence'
import { journeyAssertions, nativeJourneyFlags, scopedJourneyFinding, type JourneyObservation } from '../checks/journey-evidence'
import type { JourneyFindingDraft } from '../journey/types'
import { motionAssertions, scopeMotionFlag, type MotionObservation } from '../checks/motion-evidence'
import { slowReplayAssertions, runSlowReplayChecks } from '../checks/slow-replay'
import { SLOW_REPLAY_PROFILE, type SlowReplayResult } from '../flow/slow-replay-contract'
import type { CaptureMetrics } from '../capture-metrics'
import type { CaptureObservationScope } from '../browser/observation-scope'
import { probeUptime } from '../../uptime/probe'
import { classifyPublicRequestFailure } from '../http-failure'
import { currentUptimeState, uptimeTimeline, uptimeTransition, type UptimeProbeView } from '../../uptime/domain'
import { accountCheckAssertion, accountCheckId } from '../../sites/accounts/check-definitions'
import type { AccountObservation } from '../../sites/accounts/contracts'
import { concludeSafeFormAttempt, refuseSafeFormAdmission } from '../../sites/application/safe-form-executor'
import { bindingEvidenceIsComparable } from '../../sites/domain/assessment-comparability'
import { outcomeIncidentTransition } from '../../sites/domain/outcome-incident'
import { checkoutProbeVerdict } from '../../integrity/purchase'
import type { PathProbeResult, WalkOutcome } from '../../integrity/types'
import { factsFromAnalyticsAudience, factsFromAnalyticsRows, contextLinesForPage } from '../../sites/connections/match'
import type { AnalyticsReportScope } from '../../sites/connections/report-scope'

const WHEN = '2026-10-12T12:00:00.000Z'
const NOW = new Date(WHEN)
const SCOPE: CaptureObservationScope = { pageUrl: PAGE, finalUrl: PAGE, profile: 'desktop', access: 'public' }
const MOBILE_SCOPE: CaptureObservationScope = { pageUrl: PAGE, finalUrl: PAGE, profile: 'mobile-profile', access: 'public' }
type Scenario = AdvertisedCoverage['acceptance']['scenarios'][number]
type Verdict = 'passed' | 'failed' | 'observed' | 'incomplete' | 'unavailable' | 'transition'
type Fact = { scenario: Scenario; verdict: Verdict; identity: string; certified?: boolean }
type Handler = () => Fact[] | Promise<Fact[]>
type Source = 'http' | 'original-html' | 'rendered-dom' | 'pagespeed-desktop' | 'pagespeed-mobile' | 'axe' | 'keyboard' | 'browser-network' | 'browser-console' | 'browser-accessibility'

const PROSE = 'Our product helps developers prepare reports for their teams. Each report records the observed result clearly. Teams can review the evidence and make a useful next decision. The workflow keeps the source and its date together. '
function pageHtml(headline = 'Build useful reports for developers', body = PROSE.repeat(2), sections = '<h2>Features</h2><h2>Pricing</h2>', links = '<a href="/signup">Get started free</a><a href="/contact">Contact</a><a href="/privacy">Privacy Policy</a>') {
  return `<!doctype html><html lang="en"><head><title>Acme reports for developers</title><meta name="description" content="Acme reports help developers prepare useful evidence for their teams and customers."></head><body><main><h1>${headline}</h1>${sections}<p>${body}</p>${links}<p>hello@example.com</p></main></body></html>`
}
function metrics(overrides: Partial<CaptureMetrics> = {}): CaptureMetrics {
  const nativeLoading = { version: 1 as const, device: 'mobile' as const, scope: { pageUrl: PAGE, finalUrl: PAGE, profile: 'native-mobile', access: 'public' }, contentVisible: true, ready: true, restricted: false }
  return { mobilePrimaryCtaTopPx: 250, mobilePrimaryCtaText: 'Get started free', competingPrimaryCtaCount: 1,
    competingPrimaryCtaLabels: ['Get started free'], mobileViewportHeight: 800, mobileScrollY: 0, mobileDocumentHeight: 1600,
    stuckLoadingIndicator: false, stuckLoadingLabel: null, uniqueFontFamilies: 2, fontFamilySample: ['Inter', 'Inter Tight'],
    buttonBorderRadii: [8], motionIgnoresReducedPreference: false, motionSampleLabel: null, motionComplete: true,
    inputsBelow16px: [], inputFontSamples: [{ selector: '#email', fontSize: 16 }], inputFontsComplete: true, loadingObservation: nativeLoading, ...overrides,
    ...(overrides.inputsBelow16px?.length && !overrides.inputFontSamples ? { inputFontSamples: overrides.inputsBelow16px } : {}) }
}
function loading(milliseconds: number) {
  return { device: 'mobile' as const, initialScreenshotUrl: null, initialCaptureElapsedMs: 100, finalCaptureElapsedMs: 6000,
    loadingVisibleAtInitial: true, loadingVisibleAtFinal: false, loadingClearedMs: milliseconds, loadingLabel: 'Loading',
    finalReadyState: 'complete', finalTitle: 'Acme', observation: metrics().loadingObservation! }
}
async function inspect(module: string, source = pageHtml(), captured: CaptureMetrics | null = metrics(), metadata?: PageMetadata | null) {
  const assertions: CheckAssertion[] = []
  const context: PageCheckContext = { url: PAGE, metadata: metadata === undefined ? parseMetadataFromHtml(source, PAGE) : metadata, desktop: null, mobile: null,
    consoleErrors: [], metrics: captured, purpose: { purpose: 'marketing', reasons: ['Declared controlled product fixture'] },
    scope: {}, record: assertion => assertions.push(assertion) }
  const flags = await PAGE_CHECKS.get(module)!.evaluate(context)
  return { flags, assertions }
}
function judge(assertions: CheckAssertion[], flags: DeterministicFlag[] = [], keys?: string[]): { verdict: Verdict; identity: string } {
  const relevant = (keys ? assertions.filter(assertion => keys.includes(assertion.key)) : assertions).filter(Boolean)
  if (!relevant.length && !flags.length) return { verdict: 'unavailable', identity: 'none' }
  const hard = flags.some(flag => flag.severity === 'CRITICAL' || flag.severity === 'IMPORTANT')
  const failedAssertion = relevant.some(assertion => assertion.complete !== false && !assertion.passed && assertion.disposition !== 'observed')
  const identity = flags[0] ? observationIdentity({ checkId: flags[0].checkId, problem: flags[0].problem, rubric: flags[0].rubric })
    : `assertion:${relevant.map(assertion => assertion.key).join('+')}`
  if (failedAssertion || hard) return { verdict: 'failed', identity }
  if (relevant.some(assertion => assertion.complete === false)) return { verdict: 'incomplete', identity }
  if (relevant.some(assertion => assertion.passed && assertion.complete !== false && assertion.disposition !== 'observed')) return { verdict: 'passed', identity }
  return { verdict: 'observed', identity }
}
function receipt(module: string, assertions: CheckAssertion[], source: Source, pageUrl = PAGE) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module, pageUrl, applicable: true,
    passed: assertions.every(assertion => assertion.passed), complete: assertions.every(assertion => assertion.complete !== false), assertions,
    execution: { auditId: 'catalog', taskId: module, checkVersion: 1, source, collectedAt: WHEN } })
}
function certifies(checkId: string, flag: DeterministicFlag | undefined, assertions: CheckAssertion[], module: string, source: Source, pageUrl = PAGE) {
  if (!flag) return false
  const compared = scopedAssertionForTarget({ receipt: receipt(module, assertions, source, pageUrl), checkId, flag })
  return Boolean(compared?.assertion.passed === true && compared.assertion.complete !== false && compared.assertion.disposition !== 'observed')
}
function pair(failing: { verdict: Verdict; identity: string }, repaired: { verdict: Verdict; identity: string; certified?: boolean }, rest: Fact[]): Fact[] {
  return [
    ...rest,
    { scenario: 'failing', ...failing },
    { scenario: 'repaired', verdict: repaired.verdict, identity: repaired.identity, certified: repaired.certified },
    { scenario: 'recurring', verdict: failing.verdict, identity: failing.identity },
  ]
}
function openResult(url: string, status: number, html = '<html><body><h1>Example</h1></body></html>'): OpenCheckResult {
  const classified = classifyPublicGet({ status, finalUrl: url, requestedUrl: url, wwwAuthenticate: null, html, cfMitigated: null, httpErrorsOnly: true })
  return { url, canonicalUrl: url, outcome: classified.outcome, status, finalUrl: url, evidence: classified.evidence, shouldFlagDead: classified.shouldFlagDead }
}

const GOOD_HEADERS: Record<string, string> = {
  'content-security-policy': "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'x-permitted-cross-domain-policies': 'none',
}
function headersExcept(names: readonly string[], overrides: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...GOOD_HEADERS, ...overrides }
  for (const name of names) delete headers[name]
  return headers
}
function headerCase(key: string, checkId: string, broken: Record<string, string> | null, incompleteHeaders: Record<string, string> | null): Fact[] {
  const good = securityHeaderObservations(PAGE, GOOD_HEADERS).filter(assertion => assertion.key === key)
  const badHeaders = broken ?? {}
  const bad = securityHeaderObservations(PAGE, badHeaders).filter(assertion => assertion.key === key)
  const badFlags = runSecurityHeaderChecks(PAGE, badHeaders).filter(flag => flag.checkId === checkId)
  const missing = incompleteHeaders === null ? [] : securityHeaderObservations(PAGE, incompleteHeaders).filter(assertion => assertion.key === key)
  const later = securityHeaderObservations(PAGE, GOOD_HEADERS)
  const certified = certifies(checkId, badFlags[0], later, 'security-headers', 'http')
  const failing = judge(bad, badFlags, [key])
  return [
    { scenario: 'working', ...judge(good, [], [key]) },
    { scenario: 'incomplete', ...(missing.length ? judge(missing, [], [key]) : { verdict: 'unavailable' as const, identity: failing.identity }) },
    ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
  ]
}

function desktopMeasurement() {
  return performanceMeasurement({ lighthouseVersion: '12.0.0', fetchTime: WHEN, requestedUrl: PAGE, finalUrl: PAGE,
    configSettings: { formFactor: 'desktop', throttlingMethod: 'simulate', locale: 'en-US' } }, 'desktop')
}
function mobileMeasurement() {
  return performanceMeasurement({ lighthouseVersion: '12.0.0', fetchTime: WHEN, requestedUrl: PAGE, finalUrl: PAGE,
    configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate', locale: 'en-US' } }, 'mobile')
}
const DESKTOP_MEASUREMENT = desktopMeasurement()
const MOBILE_MEASUREMENT = mobileMeasurement()
function speed(strategy: 'desktop' | 'mobile', overrides: Partial<PageSpeedResult> = {}): PageSpeedResult {
  return { strategy, score: 90, lcp: 1200, cls: 0.02, fcp: 800, tbt: 40, inp: null, opportunities: [], resourceAudits: [],
    failedAccessibilityAudits: [], diagnostics: { measurement: strategy === 'mobile' ? MOBILE_MEASUREMENT : DESKTOP_MEASUREMENT }, raw: {}, crux: null, ...overrides,
    diagnostics: overrides.diagnostics ?? { measurement: strategy === 'mobile' ? MOBILE_MEASUREMENT : DESKTOP_MEASUREMENT } }
}
function labCase(key: 'score' | 'lcp' | 'cls', checkId: string, badValue: number): Fact[] {
  const field = key
  const badDesktop = speed('desktop', { [field]: badValue, score: key === 'score' ? badValue : 90 } as Partial<PageSpeedResult>)
  const goodDesktop = speed('desktop')
  const goodMobile = speed('mobile')
  const flags = runPerformanceChecks(badDesktop, goodMobile, PAGE).filter(flag => flag.checkId === checkId)
  const read = (desktop: PageSpeedResult, mobile: PageSpeedResult | null) => recordCheckObservations('performance', { url: PAGE, metadata: null, desktop, mobile })
    .concat(mobile ? recordCheckObservations('mobile', { url: PAGE, metadata: null, desktop: null, mobile }) : [])
    .filter(assertion => assertion.key === key)
  const failing = judge(read(badDesktop, goodMobile), flags, [key])
  const certified = certifies(checkId, flags[0], read(goodDesktop, goodMobile).filter(assertion => assertion.context?.includes(':lab:' + key)), 'performance', 'pagespeed-desktop')
  return [
    { scenario: 'working', ...judge(read(goodDesktop, goodMobile), [], [key]) },
    { scenario: 'incomplete', ...judge(read(speed('desktop', { [field]: null, score: key === 'score' ? null : 90 } as Partial<PageSpeedResult>), goodMobile), [], [key]) },
    ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
  ]
}
function resourceCase(key: string, checkId: string, audit: ResourceAudit, opportunityId: string): Fact[] {
  const bad = speed('desktop', { opportunities: [{ id: opportunityId, title: opportunityId, savings: (audit.savings ?? 0) + 1 }], resourceAudits: [audit] })
  const goodAudit = { ...audit, score: 1, savings: 0 }
  const good = speed('desktop', { resourceAudits: [goodAudit] })
  const mobile = speed('mobile', { resourceAudits: [goodAudit] })
  const flags = runPerformanceChecks(bad, mobile, PAGE).filter(flag => flag.checkId === checkId)
  const read = (desktop: PageSpeedResult) => recordCheckObservations('performance', { url: PAGE, metadata: null, desktop, mobile }).filter(assertion => assertion.key === key)
  const failing = judge(read(bad), flags, [key])
  const certified = certifies(checkId, flags[0], read(good), 'performance', 'pagespeed-desktop')
  const incomplete = speed('desktop', { resourceAudits: [{ ...audit, score: null, savings: null }] })
  return [
    { scenario: 'working', ...judge(read(good), [], [key]) },
    { scenario: 'incomplete', ...judge(read(incomplete), [], [key]) },
    ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
  ]
}

const PRESENTATION = '<html lang="en"><head><title>Example website title</title><meta name="description" content="A useful description of the example website for visitors."></head><body><h1>Example website</h1></body></html>'
async function searchObservations(body: string | undefined, evaluators: string[], overrides: Parameters<typeof evidence>[1] = {}) {
  return evaluateSearch(evidence(body, overrides), null, evaluators)
}
function searchJudge(observations: SearchObservation[], ids: string[]): { verdict: Verdict; identity: string } {
  const relevant = observations.filter(item => ids.includes(item.checkId))
  if (!relevant.length) return { verdict: 'unavailable', identity: 'search:none' }
  const flags = searchFindings(relevant).filter(flag => ids.includes(flag.checkId))
  const hard = flags.some(flag => flag.severity === 'CRITICAL' || flag.severity === 'IMPORTANT')
  const failed = relevant.some(item => item.disposition === 'failed' && item.attention.kind !== 'recommendation')
  const identity = observationIdentity({ checkId: (flags[0] ?? relevant.find(item => item.disposition === 'failed') ?? relevant[0]).checkId, problem: relevant[0].name, rubric: 'REACH' })
  if ((failed || hard) && !relevant.every(item => item.attention.kind === 'recommendation')) return { verdict: 'failed', identity }
  if (relevant.every(item => item.disposition === 'unknown' || item.disposition === 'not_applicable')) return { verdict: 'incomplete', identity }
  if (relevant.some(item => item.disposition === 'unknown') && !relevant.some(item => item.disposition === 'passed' || item.disposition === 'failed')) return { verdict: 'incomplete', identity }
  if (relevant.some(item => item.disposition === 'passed') && relevant.every(item => item.disposition === 'passed' || item.disposition === 'not_applicable' || item.attention.kind === 'observation' && item.disposition !== 'failed')) return { verdict: 'passed', identity }
  return { verdict: 'observed', identity }
}
async function searchRepair(goodBody: string, evaluators: string[], failing: SearchObservation, overrides: Parameters<typeof evidence>[1] = {}) {
  const good = await searchObservations(goodBody, evaluators, overrides)
  const receipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'catalog', pageUrl: PAGE, collectedAt: evidence().collectedAt, complete: true, observations: good })
  const recovery = assessSearchRecovery(receipt, failing.checkId, failing.attention, PAGE)
  return { certified: recovery.comparable && recovery.verdict === 'passed', recovery }
}
async function searchCase(evaluators: string[], ids: string[], samples: { working: string; failing: string; incomplete: Parameters<typeof evidence>[1]; failingOverrides?: Parameters<typeof evidence>[1]; goodOverrides?: Parameters<typeof evidence>[1] }): Promise<Fact[]> {
  const working = await searchObservations(samples.working, evaluators)
  const failingObservations = await searchObservations(samples.failing, evaluators, samples.failingOverrides)
  const blocked = document('<html><body>Error</body></html>', { status: 403 })
  const incomplete = await searchObservations(undefined, evaluators, { original: blocked, rendered: blocked, ...samples.incomplete })
  const failing = searchJudge(failingObservations, ids)
  const failedObservation = failingObservations.find(item => ids.includes(item.checkId) && (item.disposition === 'failed' || item.attention.kind === 'flag' || item.attention.kind === 'recommendation' || item.disposition === 'observed'))
  const repair = failedObservation ? await searchRepair(samples.working, evaluators, failedObservation, samples.goodOverrides) : { certified: false }
  return [
    { scenario: 'working', ...searchJudge(working, ids) },
    { scenario: 'failing', ...failing },
    { scenario: 'incomplete', ...searchJudge(incomplete, ids) },
    { scenario: 'repaired', verdict: repair.certified ? 'passed' : 'unavailable', identity: failing.identity, certified: repair.certified },
    { scenario: 'recurring', verdict: failing.verdict, identity: failing.identity },
  ]
}

function actionEvidence(overrides: Partial<PrimaryActionEvidence> = {}): PrimaryActionEvidence {
  const pageContext = primaryPageContext(PAGE, PAGE, { width: 1280, height: 720 }, SCOPE)
  return { version: 1, pageContext, controlContext: primaryControlContext({ pageContext, identity: '#primary', label: 'Get started', href: PAGE + 'start', controls: null }),
    candidateCount: 1, clicked: true, clickBlocked: false, navigation: 'changed', response: 'healthy', responseExpected: true, httpStatus: 200, ...overrides }
}
function primaryFacts(): Fact[] {
  const failed = actionEvidence({ response: 'error', httpStatus: 404 })
  const flags = scopePrimaryActionFlags(runFlowChecks({ status: 'error_response', steps: [], finalUrl: PAGE + 'start', httpStatus: 404, actionEvidence: failed }, null), failed)
  const failing = judge(primaryActionAssertions(failed), flags, ['primary-action-click'])
  const healthy = primaryActionAssertions(actionEvidence())
  const certified = certifies('flow-cta-404', flags[0], healthy, 'flow', 'rendered-dom')
  const absent = actionEvidence({ candidateCount: 0, controlContext: null, clicked: false, presenceVersion: 2, candidateComplete: false })
  return [
    { scenario: 'working', ...judge(healthy, [], ['primary-action-click', 'primary-action-presence']) },
    { scenario: 'incomplete', ...judge(primaryActionAssertions(absent), [], ['primary-action-presence']) },
    ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
  ]
}
function postClick(metrics: PostClickMetrics, action = actionEvidence()): { assertions: CheckAssertion[]; flags: DeterministicFlag[] } {
  const result = { status: 'success' as const, steps: [], finalUrl: metrics.pageUrl ?? PAGE + 'start', postClickMetrics: metrics, actionEvidence: action }
  return { assertions: postClickAssertions(metrics, result.finalUrl, action), flags: scopePostClickFlags(runPostClickFlowChecks(metrics, result.finalUrl), result) }
}
function contentFacts(blank: boolean): Fact[] {
  const destination = PAGE + 'start'
  const action = actionEvidence()
  const base = { version: 2 as const, stuckLoading: false, blankScreenMs: 0, stuckLoadingLabel: null, contentComplete: true, loadingComplete: true, observedForMs: 4000, pageUrl: destination }
  const slow = postClick({ ...base, timeToFirstContentMs: null, contentAbsentThroughMs: 4000, blankScreenMs: 4000 }, action)
  const fast = postClick({ ...base, timeToFirstContentMs: 100, contentAbsentThroughMs: 100 }, action)
  const open = postClick({ ...base, timeToFirstContentMs: null, contentComplete: false, contentAbsentThroughMs: 0 }, action)
  const key = 'destination-content-timing'
  const failing = judge(slow.assertions, slow.flags.filter(flag => flag.checkId === 'flow-cta-blank-destination'), [key])
  const certified = certifies('flow-cta-blank-destination', slow.flags.find(flag => flag.checkId === 'flow-cta-blank-destination'), fast.assertions, 'flow', 'rendered-dom')
  return [
    { scenario: 'working', ...judge(fast.assertions, [], [key]) },
    { scenario: 'incomplete', ...judge(open.assertions, [], [key]) },
    ...pair(failing, { verdict: certified ? 'passed' : blank ? 'observed' : 'observed', identity: failing.identity, certified }, []),
  ]
}
function destinationUx(overrides: Partial<DestinationUXQuality> = {}): DestinationUXQuality {
  return {
    contentComplete: true, controlsComplete: true, hasClearHeadline: true, hasPrimaryCTA: true, ctaText: 'Continue', ctaPromisesMatch: true,
    headline: 'Start the useful service', pageType: null, visibleCtaCount: 1, actionableCtaCount: 1, primaryCtaHref: PAGE + 'next',
    trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
    mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
    frictionSignals: { ctaCount: 1, distinctCtaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false },
    loadQuality: { hadStuckLoading: false, timeToContentMs: 100, layoutShift: false, version: 2, contentAbsentThroughMs: 100 },
    ...overrides,
    trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true, ...overrides.trustSignals },
    frictionSignals: { ctaCount: 1, distinctCtaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false, ...overrides.frictionSignals },
    loadQuality: { hadStuckLoading: false, timeToContentMs: 100, layoutShift: false, version: 2, contentAbsentThroughMs: 100, ...overrides.loadQuality },
  }
}
function destinationScan(ux: DestinationUXQuality, metrics?: PostClickMetrics): FlowScanResult {
  return { status: 'success', steps: [], finalUrl: PAGE + 'start', ctaText: 'Get started free', destinationUX: ux, actionEvidence: actionEvidence(), ...(metrics ? { postClickMetrics: metrics } : {}) }
}
function loadingFacts(): Fact[] {
  const destination = PAGE + 'start'
  const base = { version: 2 as const, timeToFirstContentMs: 100, blankScreenMs: 100, stuckLoadingLabel: 'Loading', contentComplete: true, loadingComplete: true, observedForMs: 3000, contentAbsentThroughMs: 100, pageUrl: destination }
  const stuck = postClick({ ...base, stuckLoading: true })
  const clear = postClick({ ...base, stuckLoading: false })
  const key = 'destination-loading-ui'
  const failing = judge(stuck.assertions, stuck.flags.filter(flag => flag.checkId === 'flow-cta-stuck-loading'), [key])
  const certified = certifies('flow-cta-stuck-loading', stuck.flags.find(flag => flag.checkId === 'flow-cta-stuck-loading'), clear.assertions, 'flow', 'rendered-dom')
  return [
    { scenario: 'working', ...judge(clear.assertions, [], [key]) },
    { scenario: 'incomplete', verdict: 'unavailable', identity: 'post-click:version' },
    ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
  ]
}

function axeCase(rule: string, checkId: string): Fact[] {
  const violation = (state: 'passed' | 'failed' | 'incomplete'): AxeViolation[] => state === 'failed' ? [{ id: rule, impact: 'serious', description: rule, help: rule, helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/' + rule, nodes: [{ html: '<button></button>', target: ['button'], failureSummary: 'The recorded element failed this rule.' }] }] : []
  const run = (state: 'passed' | 'failed' | 'incomplete') => evaluateAccessibility({ metadata: parseMetadataFromHtml('<html lang="en"><body><main><h1>Example</h1><button>Start</button></main></body></html>', PAGE),
    evidence: { scope: SCOPE, engine: '4.10.0', rules: [{ id: rule, state, nodes: state === 'failed' ? 1 : 0 }] }, scope: SCOPE, axe: violation(state) })
  const failed = run('failed')
  const passed = run('passed')
  const key = 'axe:' + checkId
  const failing = judge(failed.assertions, failed.flags.filter(flag => flag.checkId === checkId), [key])
  const certified = certifies(checkId, failed.flags.find(flag => flag.checkId === checkId), passed.assertions, 'accessibility', 'browser-accessibility')
  return [
    { scenario: 'working', ...judge(passed.assertions, [], [key]) },
    { scenario: 'incomplete', ...judge(run('incomplete').assertions, [], [key]) },
    ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
  ]
}

function keyboard(overrides: Partial<KeyboardEvidence>): KeyboardEvidence {
  return keyboardEvidenceSchema.parse({ version: 1, pageUrl: PAGE, collectedAt: WHEN, complete: true, reason: 'document_boundary_observed', candidateCount: 2,
    trap: 'not_observed', limitations: [], navigationComplete: true, scope: SCOPE, steps: [
      { id: 1, selector: '#a', label: 'First', domOrder: 0, tabIndex: 0, indicator: 'styled', rect: { x: 10, y: 10, width: 100, height: 30 } },
      { id: 2, selector: '#b', label: 'Second', domOrder: 1, tabIndex: 0, indicator: 'styled', rect: { x: 10, y: 50, width: 100, height: 30 } },
    ], ...overrides })
}
function keyboardFacts(kind: 'focus' | 'trap' | 'order'): Fact[] {
  const failedEvidence = kind === 'focus' ? keyboard({ steps: [{ id: 1, selector: '#a', label: 'First', domOrder: 0, tabIndex: 0, indicator: 'missing', rect: { x: 10, y: 10, width: 100, height: 30 } }] })
    : kind === 'trap' ? keyboard({ trap: 'blocked' })
    : keyboard({ steps: [
      { id: 1, selector: '#a', label: 'First', domOrder: 2, tabIndex: 1, indicator: 'styled', rect: { x: 10, y: 10, width: 100, height: 30 } },
      { id: 2, selector: '#b', label: 'Second', domOrder: 0, tabIndex: 0, indicator: 'styled', rect: { x: 10, y: 50, width: 100, height: 30 } },
    ] })
  const failed = runKeyboardChecks(failedEvidence)
  const healthy = runKeyboardChecks(keyboard({}))
  const checkId = kind === 'focus' ? 'focus-visible-missing' : kind === 'trap' ? 'keyboard-nav-trap' : 'keyboard-tab-order'
  const key = kind === 'focus' ? 'focus-styles' : kind === 'trap' ? 'keyboard-exit' : 'tab-sequence'
  const failing = judge(failed.assertions, failed.flags.filter(flag => flag.checkId === checkId), [key])
  const certified = certifies(checkId, failed.flags.find(flag => flag.checkId === checkId), healthy.assertions, 'keyboard', 'keyboard')
  const incomplete = kind === 'trap' ? runKeyboardChecks(keyboard({ limitations: ['protected_action_refused'] }))
    : kind === 'order' ? runKeyboardChecks(keyboard({ navigationComplete: false, complete: false }))
    : runKeyboardChecks(keyboard({ steps: [{ id: 1, selector: '#a', label: 'First', domOrder: 0, tabIndex: 0, indicator: 'unknown', rect: { x: 10, y: 10, width: 100, height: 30 } }], complete: false }))
  return [
    { scenario: 'working', ...judge(healthy.assertions, [], [key]) },
    { scenario: 'incomplete', ...(incomplete.assertions.length ? judge(incomplete.assertions, [], [key]) : { verdict: 'unavailable' as const, identity: failing.identity }) },
    ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
  ]
}

async function heuristic(module: string, key: string, broken: { html?: string; captured?: Partial<CaptureMetrics> }, empty: 'html' | 'metrics'): Promise<Fact[]> {
  const healthy = await inspect(module)
  const failed = await inspect(module, broken.html ?? pageHtml(), metrics(broken.captured))
  const missing = empty === 'html' ? await inspect(module, '<html><body></body></html>', null) : await inspect(module, pageHtml(), null)
  const flags = failed.flags.filter(() => failed.assertions.some(assertion => assertion.key === key))
  const failing = judge(failed.assertions, flags.length ? flags : failed.flags, [key])
  const later = judge(healthy.assertions, [], [key])
  return [
    { scenario: 'working', ...judge(healthy.assertions, [], [key]) },
    { scenario: 'failing', ...failing },
    { scenario: 'incomplete', ...judge(missing.assertions, [], [key]) },
    { scenario: 'repaired', verdict: later.verdict === 'passed' ? 'passed' : later.verdict, identity: failing.identity },
  ]
}

function trustFacts(key: 'privacy-link' | 'contact-information', checkId: string, failingHtml: string): Fact[] {
  const good = publicTrustObservations(parseMetadataFromHtml(pageHtml(), PAGE))[key]
  const bad = publicTrustObservations(parseMetadataFromHtml(failingHtml, PAGE))[key]
  const flags = runTrustChecks(PAGE, parseMetadataFromHtml(failingHtml, PAGE)).filter(flag => flag.checkId === checkId)
  const failing = judge([bad], flags, [key])
  if (good.passed !== true || good.complete === false || bad.passed || bad.complete === false) throw new Error(checkId + ' trust observation changed')
  return [
    { scenario: 'working', ...judge([good], [], [key]) },
    { scenario: 'failing', ...failing },
    { scenario: 'incomplete', verdict: 'unavailable', identity: failing.identity },
    { scenario: 'repaired', verdict: 'observed', identity: failing.identity },
  ]
}

function accountFacts(kind: AccountObservation['kind']): Fact[] {
  const checkId = accountCheckId[kind]
  const item = (state: AccountObservation['state']): Fact['verdict'] extends never ? never : ReturnType<typeof accountCheckAssertion> => accountCheckAssertion({ kind, state, detail: `${kind} ${state} on the recorded page.`, pageUrl: PAGE })
  const verified = item('verified'), failed = item('failed'), unknown = item('unknown')
  const identity = observationIdentity({ checkId, problem: failed.observed, rubric: 'EXPERIENCE' })
  const failing = judge([failed], [], [failed.key])
  return [
    { scenario: 'working', ...judge([verified], [], [verified.key]), identity },
    { scenario: 'failing', verdict: failing.verdict, identity },
    { scenario: 'incomplete', ...judge([unknown], [], [unknown.key]), identity },
    { scenario: 'repaired', verdict: 'passed', identity },
    { scenario: 'recurring', verdict: failing.verdict, identity },
  ]
}
const FIXTURE = { authorizedAt: new Date(WHEN), lastDryRunVersion: 1, version: 1, targetUrl: PAGE + 'signup', resetUrl: PAGE + 'hooks/reset', cleanupUrl: PAGE + 'hooks/cleanup' }
function admitted() {
  return refuseSafeFormAdmission(FIXTURE, { startUrl: FIXTURE.targetUrl, allowLocalhost: false, setupAdmitted: true })
}

function discoveryPlan(links: Array<{ href: string; text: string }>, ceiling?: number): ReviewPlan {
  return planReviewTargets({ pastedUrl: PAGE, depth: 2, pastedLinks: links, reviewCeiling: ceiling })
}
function discoveryIdentity(plan: ReviewPlan) {
  return `discovery:${plan.reviewUrls.join(',')}:truncated:${plan.truncated}`
}

const AUDIENCE: AnalyticsReportScope = { version: 1, kind: 'analytics-hostnames', propertyId: 'properties/1', hostnames: ['example.com'] }
function uptimeProbe(scheduledAt: string, result: 'ONLINE' | 'FAILED' | 'UNKNOWN', confirmed: boolean): UptimeProbeView {
  return { id: scheduledAt + result, scheduledAt, observedAt: scheduledAt, attempt: confirmed ? 2 : 1, result, confirmed, targetUrl: PAGE,
    reason: result === 'FAILED' ? 'response_error' : 'response_received', statusCode: result === 'ONLINE' ? 200 : result === 'FAILED' ? 500 : 403, durationMs: 20, finalUrl: PAGE }
}
function transitionFacts(label: string): Fact[] {
  const opened = uptimeTransition({ result: 'FAILED', now: NOW, confirmation: true, pendingFailureAt: new Date(NOW.getTime() - 30_000), incidentOpen: false })
  const recovered = uptimeTransition({ result: 'ONLINE', now: NOW, confirmation: false, pendingFailureAt: null, incidentOpen: true })
  const unknown = uptimeTransition({ result: 'UNKNOWN', now: NOW, confirmation: false, pendingFailureAt: NOW, incidentOpen: false })
  const again = uptimeTransition({ result: 'FAILED', now: new Date(NOW.getTime() + 10 * 60_000), confirmation: true, pendingFailureAt: new Date(NOW.getTime() + 10 * 60_000 - 30_000), incidentOpen: false })
  if (opened.event !== 'opened' || opened.state !== 'offline' || recovered.event !== 'recovered' || again.event !== 'opened') throw new Error(label + ' uptime transition changed')
  const identity = 'uptime:opened'
  const fresh = currentUptimeState({ enabled: true, state: 'online', lastCheckedAt: NOW, now: NOW })
  const stale = currentUptimeState({ enabled: true, state: 'online', lastCheckedAt: new Date(NOW.getTime() - 11 * 60_000), now: NOW })
  return [
    { scenario: 'working', verdict: fresh === 'online' ? 'observed' : 'failed', identity: 'uptime:online' },
    { scenario: 'failing', verdict: 'failed', identity },
    { scenario: 'incomplete', verdict: unknown.state === 'unknown' && stale === 'unknown' ? 'incomplete' : 'failed', identity: 'uptime:unknown' },
    { scenario: 'repaired', verdict: 'transition', identity: 'uptime:recovered' },
    { scenario: 'recurring', verdict: 'failed', identity },
  ]
}

const handlers: Record<string, Handler> = {
  'pages.discovery': () => {
    const url = PAGE + 'pricing'
    const working = discoveryPlan([{ href: url, text: 'Pricing' }])
    const excluded = discoveryPlan([{ href: 'javascript:void(0)', text: 'App' }])
    const truncated = discoveryPlan([{ href: url, text: 'Pricing' }, { href: PAGE + 'about', text: 'About' }], 1)
    if (!working.reviewUrls.includes(url) || working.truncated || excluded.reviewUrls.some(item => item.startsWith('javascript:')) || !truncated.truncated) throw new Error('Discovery plan did not match the recorded links')
    const bad = publicLinkObservations(PAGE, [url], [openResult(url, 404)])
    const good = publicLinkObservations(PAGE, [url], [openResult(url, 200)])
    const other = publicLinkObservations(PAGE, [PAGE + 'about'], [openResult(PAGE + 'about', 200)])
    const failing = judge(bad.assertions, bad.flags, ['public-destination'])
    const certified = certifies('broken-internal-links', bad.flags[0], good.assertions, 'seo', 'http')
    if (certifies('broken-internal-links', bad.flags[0], other.assertions, 'seo', 'http')) throw new Error('Discovery repair accepted a different page')
    return [
      { scenario: 'working', verdict: 'observed', identity: discoveryIdentity(working) },
      { scenario: 'failing', ...failing },
      { scenario: 'incomplete', verdict: truncated.truncated ? 'incomplete' : 'failed', identity: discoveryIdentity(truncated) },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified },
      { scenario: 'recurring', verdict: failing.verdict, identity: failing.identity },
    ]
  },
  'pages.internal-links': () => {
    const url = PAGE + 'pricing'
    const bad = publicLinkObservations(PAGE, [url], [openResult(url, 404)])
    const good = publicLinkObservations(PAGE, [url], [openResult(url, 200)])
    const blocked = publicLinkObservations(PAGE, [url], [openResult(url, 403)])
    const failing = judge(bad.assertions, bad.flags, ['public-destination'])
    const certified = certifies('broken-internal-links', bad.flags[0], good.assertions, 'seo', 'http')
    return [
      { scenario: 'working', ...judge(good.assertions, [], ['public-destination']) },
      { scenario: 'incomplete', ...judge(blocked.assertions, [], ['public-destination']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'pages.section-links': () => {
    const present = parseMetadataFromHtml('<html><body><a href="#pricing">Pricing</a><h2 id="pricing">Pricing</h2></body></html>', PAGE)
    const absent = parseMetadataFromHtml('<html><body><a href="#missing">Pricing</a><h2 id="pricing">Pricing</h2></body></html>', PAGE)
    const restored = parseMetadataFromHtml('<html><body><a href="#missing">Pricing</a><h2 id="missing">Pricing</h2></body></html>', PAGE)
    const good = sectionLinkObservations(PAGE, present, SCOPE)
    const bad = sectionLinkObservations(PAGE, absent, SCOPE)
    const open = sectionLinkObservations(PAGE, absent)
    const failing = judge(bad.assertions, bad.flags, ['section-target'])
    const certified = certifies('broken-page-anchors', bad.flags[0], sectionLinkObservations(PAGE, restored, SCOPE).assertions, 'seo', 'rendered-dom')
    return [
      { scenario: 'working', ...judge(good.assertions, [], ['section-target']) },
      { scenario: 'incomplete', ...judge(open.assertions, [], ['section-target']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'pages.responses': () => {
    const good = assessPageResponse(PAGE, document('<html><body><h1>Example</h1></body></html>'))
    const bad = assessPageResponse(PAGE, document('<html><body>Missing</body></html>', { status: 404 }))
    const blocked = assessPageResponse(PAGE, document('<html><body>Forbidden</body></html>', { status: 403 }))
    const failing = judge(bad.assertions, bad.flags, ['page-response'])
    const certified = certifies('page-http-error', bad.flags[0], good.assertions, 'page-response', 'http')
    return [
      { scenario: 'working', ...judge(good.assertions, good.flags, ['page-response']) },
      { scenario: 'incomplete', ...judge(blocked.assertions, blocked.flags, ['page-response']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'pages.pricing-contact': () => {
    const context = 'flow:pricing:v1:' + 'a'.repeat(64)
    const broken: PricingNavigationEvidence = { context, complete: true, passed: false, reason: 'missing-section' }
    const visible: PricingNavigationEvidence = { context, complete: true, passed: true, reason: 'visible-section' }
    const unknown: PricingNavigationEvidence = { context, complete: false, passed: false, reason: 'unavailable' }
    const flag = runFlowChecks({ status: 'skipped', steps: [], finalUrl: PAGE, multiStep: { pricingNav: 'broken', pricingNavLabel: 'Pricing', pricingNavHref: '#pricing', pricingEvidence: broken, formValidation: 'skipped', mobileMenu: 'skipped' } }).find(item => item.checkId === 'flow-pricing-nav-broken')
    const failing = judge(pricingNavigationAssertions(broken), flag ? [flag] : [], ['pricing-navigation'])
    const certified = certifies('flow-pricing-nav-broken', flag, pricingNavigationAssertions(visible), 'flow', 'rendered-dom')
    return [
      { scenario: 'working', ...judge(pricingNavigationAssertions(visible), [], ['pricing-navigation']) },
      { scenario: 'incomplete', ...judge(pricingNavigationAssertions(unknown), [], ['pricing-navigation']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'pages.action-destinations': primaryFacts,
  'conversion.primary-action': primaryFacts,
  'pages.blank-dead-end': () => contentFacts(true),
  'pages.destination-content': () => {
    const keys = ['destination-headline', 'destination-next-action']
    const ids = ['flow-destination-no-headline', 'flow-destination-no-cta']
    const missing = destinationUx({ hasClearHeadline: false, headline: null, hasPrimaryCTA: false, primaryCtaHref: null, ctaText: null,
      frictionSignals: { ctaCount: 0, distinctCtaCount: 0, tooManyCTAs: false, hasDeadEnd: true, formRequiredForValue: false } })
    const unfinished = destinationUx({ contentComplete: false, controlsComplete: false, hasClearHeadline: false, headline: null, hasPrimaryCTA: false, ctaText: null, primaryCtaHref: null,
      frictionSignals: { ctaCount: 0, distinctCtaCount: 0, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false } })
    const badScan = destinationScan(missing)
    const goodScan = destinationScan(destinationUx())
    const found = runFlowChecks(badScan)
    const flags = ids.flatMap(id => { const flag = found.find(item => item.checkId === id); return flag ? [flag] : [] })
    const good = destinationContentObservations(goodScan)
    const failing = judge(destinationContentObservations(badScan), flags, keys)
    const certified = ids.every(id => certifies(id, flags.find(flag => flag.checkId === id), good, 'flow', 'rendered-dom'))
    if (flags.length !== ids.length || failing.identity === 'check:flow-cta-blank-destination') throw new Error('Destination content did not record the headline and next action')
    return [
      { scenario: 'working', ...judge(good, [], keys) },
      { scenario: 'incomplete', ...judge(destinationContentObservations(destinationScan(unfinished)), [], keys) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'pages.loading': loadingFacts,
  'performance.destination-loading': () => {
    const destination = PAGE + 'start'
    const timed = (delay: number | null, stuck: boolean | null, complete: boolean): PostClickMetrics => ({
      version: 2, timeToFirstContentMs: delay, blankScreenMs: delay, stuckLoading: stuck, stuckLoadingLabel: stuck ? 'Loading' : null,
      contentComplete: complete, loadingComplete: complete, observedForMs: complete ? 5000 : 0, contentAbsentThroughMs: delay ?? 0, pageUrl: destination,
    })
    const read = (metrics: PostClickMetrics) => {
      const scan = destinationScan(destinationUx({ loadQuality: { hadStuckLoading: metrics.stuckLoading, timeToContentMs: metrics.timeToFirstContentMs, layoutShift: false, version: 2, contentAbsentThroughMs: metrics.contentAbsentThroughMs } }), metrics)
      return { scan, assertions: postClickAssertions(metrics, scan.finalUrl, scan.actionEvidence), flags: runFlowChecks(scan) }
    }
    const slow = read(timed(4200, true, true))
    const fast = read(timed(100, false, true))
    const open = read(timed(null, null, false))
    const keys = ['destination-content-timing', 'destination-loading-ui']
    const delay = slow.flags.find(flag => flag.checkId === 'flow-destination-slow-load')
    const stuck = slow.flags.find(flag => flag.checkId === 'flow-cta-stuck-loading')
    const timing = slow.assertions.find(assertion => assertion.key === 'destination-content-timing')
    const loadingUi = slow.assertions.find(assertion => assertion.key === 'destination-loading-ui')
    if (!delay || !stuck || delay.verificationRule !== POST_CLICK_VERIFICATION_RULE || !timing?.observed.includes('4200ms') || loadingUi?.complete !== true || loadingUi.passed !== false) throw new Error('Destination loading did not record the post-click timing and loading UI')
    const failing = judge(slow.assertions, [delay, stuck], keys)
    const certified = certifies('flow-destination-slow-load', delay, fast.assertions, 'flow', 'rendered-dom') && certifies('flow-cta-stuck-loading', stuck, fast.assertions, 'flow', 'rendered-dom')
    if (failing.identity === 'check:flow-cta-blank-destination' || failing.identity === 'check:flow-cta-stuck-loading') throw new Error('Destination loading used the blank-page or stuck-loading check')
    return [
      { scenario: 'working', ...judge(fast.assertions, [], keys) },
      { scenario: 'incomplete', ...judge(open.assertions, [], keys) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'pages.promise-consistency': () => {
    const key = 'destination-promise'
    const badScan = destinationScan(destinationUx({ ctaPromisesMatch: false, headline: 'Unrelated offer' }))
    const goodScan = destinationScan(destinationUx({ ctaPromisesMatch: true, headline: 'Get started free today' }))
    const openScan = destinationScan(destinationUx({ contentComplete: false, ctaPromisesMatch: false, headline: null }))
    const flags = runFlowChecks(badScan).filter(flag => flag.checkId === 'flow-cta-message-mismatch')
    const good = destinationContentObservations(goodScan)
    const promise = good.find(assertion => assertion.key === key)
    const failing = judge(destinationContentObservations(badScan), flags, [key])
    const certified = certifies('flow-cta-message-mismatch', flags[0], good, 'flow', 'rendered-dom')
    if (!promise?.passed || promise.complete === false || promise.disposition === 'observed' || failing.identity === 'check:flow-cta-destination-no-trust') throw new Error('Promise consistency did not use the destination promise')
    return [
      { scenario: 'working', ...judge(good, [], [key]) },
      { scenario: 'incomplete', ...judge(destinationContentObservations(openScan), [], [key]) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'conversion.validation': () => {
    const form = (overrides: Partial<FormEvidence>): FormEvidence => ({ version: 1, pageUrl: PAGE, context: 'form:catalog', selector: '#signup', label: 'Signup', disposition: 'passed', reason: 'native_feedback', feedbackMs: 100, ...overrides })
    const good = checkFormValidation(form({}))
    const bad = checkFormValidation(form({ disposition: 'failed', reason: 'missing_feedback', feedbackMs: null }))
    const open = checkFormValidation(form({ disposition: 'unknown', reason: 'observation_incomplete', feedbackMs: null }))
    const failing = judge(bad.assertions, bad.flags, ['empty-form-validation'])
    const certified = certifies('flow-form-no-validation', bad.flags[0], good.assertions, 'form-validation', 'rendered-dom')
    return [
      { scenario: 'working', ...judge(good.assertions, [], ['empty-form-validation']) },
      { scenario: 'incomplete', ...judge(open.assertions, [], ['empty-form-validation']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'conversion.feedback': () => {
    const form = (feedbackMs: number): FormEvidence => ({ version: 1, pageUrl: PAGE, context: 'form:catalog', selector: '#signup', label: 'Signup', disposition: 'passed', reason: 'native_feedback', feedbackMs })
    const good = checkFormValidation(form(100))
    const bad = checkFormValidation(form(1500))
    const open = checkFormValidation({ ...form(0), reason: 'native_validation' })
    const failing = judge(bad.assertions, bad.flags.filter(flag => flag.checkId === 'flow-form-slow-feedback'), ['form-feedback'])
    const certified = certifies('flow-form-slow-feedback', bad.flags.find(flag => flag.checkId === 'flow-form-slow-feedback'), good.assertions, 'form-validation', 'rendered-dom')
    return [
      { scenario: 'working', ...judge(good.assertions, [], ['form-feedback']) },
      { scenario: 'incomplete', ...(open.assertions.length ? judge(open.assertions, [], ['form-feedback']) : { verdict: 'unavailable' as const, identity: 'form:none' }) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'conversion.mobile-navigation': () => {
    const context = mobileNavigationContext(MOBILE_SCOPE, '#menu')
    const link = (reachable: boolean) => ({ identity: mobileLinkIdentity('/pricing', 'Pricing'), selector: 'a.pricing', label: 'Pricing', reachable })
    const observed = (reachable: boolean, complete = true): MobileNavigationObservation => ({ context, selector: '#menu', label: 'Menu', complete, opened: true, reason: reachable ? 'original_navigation_links_visible' : 'declared_menu_did_not_reveal_links_within_1500ms', links: [link(reachable)] })
    const bad = mobileNavigationFlags([observed(false)], PAGE)
    const failing = judge(mobileNavigationAssertions([observed(false)]), bad, ['mobile-navigation'])
    const certified = certifies('flow-mobile-menu-broken', bad[0], mobileNavigationAssertions([observed(true)]), 'mobile-navigation', 'rendered-dom')
    return [
      { scenario: 'working', ...judge(mobileNavigationAssertions([observed(true)]), [], ['mobile-navigation']) },
      { scenario: 'incomplete', ...judge(mobileNavigationAssertions([observed(false, false)]), [], ['mobile-navigation']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'conversion.checkout-entry': () => {
    const outcome = (overrides: Partial<WalkOutcome>): WalkOutcome => ({ reachedCheckout: false, httpStatus: 200, buyControlFound: true, buyControlClicked: false, cartUpdated: false, checkoutErrorVisible: false, botWall: false, passwordGate: false, timedOut: false, pageUnavailable: false, failedStep: null, ...overrides })
    const probe = (health: PathProbeResult['health'], reason: PathProbeResult['reason'], confirmed: boolean, walk: WalkOutcome): PathProbeResult => {
      const attempt = { outcome: walk, steps: [], videoUrl: null, gifUrl: null, finalUrl: PAGE + 'checkout' }
      return { health, reason, confirmed, attempts: [attempt], steps: [], videoUrl: null, gifUrl: null, failedStep: null, finalUrl: PAGE + 'checkout' }
    }
    const clear = checkoutProbeVerdict(probe('GREEN', 'checkout_reached', true, outcome({ reachedCheckout: true, buyControlClicked: true })))
    const failed = checkoutProbeVerdict(probe('RED', 'http_error', true, outcome({ pageUnavailable: true, httpStatus: 500 })))
    const open = checkoutProbeVerdict(probe('UNKNOWN', 'timeout', false, outcome({ timedOut: true })))
    if (!clear.isClear || clear.reason !== 'checkout_reached' || clear.disposition !== 'SUCCEEDED') throw new Error('Checkout clear verdict changed')
    if (!failed.isFlag || failed.disposition !== 'FAILED') throw new Error('Checkout failure verdict changed')
    const coverage = { environment: 'catalog', requiredBindings: ['checkout'], observedBindings: ['checkout'], scope: { pageUrl: PAGE, device: 'mobile' },
      bindings: [{ key: 'checkout', version: 1, mechanism: 'BROWSER_JOURNEY', config: { startUrl: PAGE, safety: 'stop-at-checkout' } }] }
    const comparable = bindingEvidenceIsComparable({ environment: coverage.environment, requiredBindings: coverage.requiredBindings, bindings: coverage.bindings }, { key: 'checkout', version: 1, required: true, mechanism: 'BROWSER_JOURNEY' }, coverage.environment)
    if (!comparable || clear.disposition !== 'SUCCEEDED') throw new Error('Checkout binding comparison changed')
    const failure = outcomeIncidentTransition({ state: 'FLAG', coverage, evidence: { reason: failed.reason }, runRequestId: 'failed', flagIds: ['checkout-flag'], previous: null })
    const prior = { id: 'failed-assessment', state: 'FLAG', coverage, evidence: { incident: failure, reason: failed.reason } }
    const recovered = outcomeIncidentTransition({ state: 'CLEAR', coverage, evidence: { reason: clear.reason }, runRequestId: 'repaired', flagIds: [], previous: prior })
    const changed = outcomeIncidentTransition({ state: 'CLEAR', coverage: { ...coverage, bindings: [{ ...coverage.bindings[0], version: 2 }] }, evidence: { reason: clear.reason }, runRequestId: 'changed', flagIds: [], previous: prior })
    const certified = recovered.transition === 'recovery' && recovered.recoveredFlagIds.includes('checkout-flag') && changed.transition !== 'recovery'
    return [
      { scenario: 'working', verdict: 'observed', identity: 'checkout:checkout_reached' },
      { scenario: 'failing', verdict: 'failed', identity: 'checkout:http_error' },
      { scenario: 'incomplete', verdict: open.disposition === 'BLOCKED' && !open.isClear ? 'incomplete' : 'failed', identity: 'checkout:timeout' },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'observed', identity: 'checkout:http_error', certified },
      { scenario: 'recurring', verdict: 'failed', identity: 'checkout:http_error' },
    ]
  },
  'conversion.action-links': () => {
    const url = PAGE + 'login'
    const read = (status: number) => actionDestinationObservation(PAGE, url, 'auth', openResult(url, status, '<html><body><h1>Sign in</h1></body></html>'))
    const bad = read(404)
    const good = read(200)
    const blocked = read(403)
    const flag = bad.complete && !bad.passed ? deadDestinationFlags([openResult(url, 404)], PAGE)[0] : undefined
    const authFlag = flag ? { ...flag, checkId: 'auth-page-broken' } : undefined
    const failing = judge([bad], authFlag ? [authFlag] : [], ['auth-destination'])
    const certified = certifies('auth-page-broken', authFlag, [good], 'auth-checkout', 'http')
    return [
      { scenario: 'working', ...judge([good], [], ['auth-destination']) },
      { scenario: 'incomplete', ...judge([blocked], [], ['auth-destination']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'conversion.journey-failures': () => {
    const observation = (primaryAction: boolean, actionComplete = true): JourneyObservation => ({ version: 1, journeyType: 'first-visit', phase: 'landing', scope: SCOPE, route: [{ selector: '#cta', label: 'Start' }],
      available: actionComplete, pathComplete: true, headline: true, primaryAction, nextPath: true, fieldCount: 0, actionVersion: 3, actionComplete, headlineVersion: 2, headlineComplete: true, pathVersion: 2 })
    const draft: JourneyFindingDraft = { checkId: 'journey-first-visit-hidden-cta', url: SCOPE.finalUrl, stepNumber: 1, rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: 'CONVERSION', problem: 'The first-visit action is not available', evidence: 'The landing action was not rendered.', whyItMatters: 'Visitors cannot continue.', fix: 'Render the recorded action.', findingType: 'dead-end' }
    const failed = observation(false)
    const scoped = scopedJourneyFinding(draft, [failed])
    const flags = nativeJourneyFlags(scoped ? [scoped] : [])
    const repaired = observation(true)
    const failing = judge(journeyAssertions(failed), flags, ['landing-action'])
    const certified = certifies(flags[0]?.checkId ?? 'journey-hidden-cta', flags[0], journeyAssertions(repaired), 'journeys', 'rendered-dom')
    const identity = observationIdentity({ checkId: draft.checkId, problem: draft.problem, rubric: draft.rubric })
    return [
      { scenario: 'working', ...judge(journeyAssertions(repaired), [], ['landing-action']), identity },
      { scenario: 'failing', verdict: failing.verdict, identity },
      { scenario: 'incomplete', ...judge(journeyAssertions(observation(false, false)), [], ['landing-action']), identity },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'observed', identity, certified },
      { scenario: 'recurring', verdict: failing.verdict, identity },
    ]
  },
  'conversion.overlays': () => {
    const context = overlayControlContext(SCOPE, 'cta', '#cta')
    const blocker = { tag: 'div', id: 'cover', className: 'modal', role: 'dialog', text: 'Stay', zIndex: '20', coverageFraction: 0.8, persisted: true, looksLikeOverlay: true }
    const observed = (disposition: 'passed' | 'failed' | 'unknown', reason: 'clear' | 'persistent_overlay' | 'unavailable'): OverlayObservation => overlayObservationSchema.parse({ version: 1, device: 'desktop', scope: SCOPE, phase: 'page_load', complete: disposition !== 'unknown', contentVisible: true, restricted: false,
      controls: [{ kind: 'cta', selector: '#cta', label: 'Start', context, disposition, reason, blocker: disposition === 'failed' ? blocker : null }] })
    const bad = observed('failed', 'persistent_overlay')
    const good = observed('passed', 'clear')
    const flags = runObservedOverlayChecks(bad)
    const failing = judge(overlayAssertions(bad), flags, ['overlay-cta'])
    const goodReceipt = overlayCheckReceipts([good], { auditId: 'catalog', taskId: 'overlays', collectedAt: WHEN })[0]
    const compared = flags[0] ? scopedAssertionForTarget({ receipt: goodReceipt, checkId: flags[0].checkId, flag: flags[0] }) : undefined
    const certified = Boolean(compared?.assertion.passed && compared.assertion.complete !== false && compared.assertion.disposition !== 'observed')
    return [
      { scenario: 'working', ...judge(overlayAssertions(good), [], ['overlay-cta']) },
      { scenario: 'incomplete', ...judge(overlayAssertions(observed('unknown', 'unavailable')), [], ['overlay-cta']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'conversion.reduced-motion': () => {
    const window = (reduced: boolean, count: number) => ({ version: 1 as const, pageUrl: PAGE, reduced, targets: Array.from({ length: count }, (_, index) => ({ family: 'css' as const, selector: '#motion-' + index, label: 'Hero ' + index, sample: 'transform ' + index })), complete: true, windowMs: 2000, observedMs: 2200, restricted: false, contentVisible: true })
    const observed = (after: number): MotionObservation => ({ version: 1, scope: MOBILE_SCOPE, before: window(false, 4), after: window(true, after) })
    const bad = observed(4)
    const good = observed(0)
    const flag = scopeMotionFlag({ checkId: 'motion-ignores-reduced-preference', rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Motion continues under reduced motion', evidence: 'CSS motion continued.', fix: 'Honor the reduced-motion preference.', confidence: 1, source: 'DETERMINISTIC' }, bad)
    const css = (value: MotionObservation) => motionAssertions(value).filter(assertion => assertion.context?.endsWith(':css'))
    const failing = judge(css(bad), flag.verificationRule ? [flag] : [], ['reduced-motion'])
    const certified = certifies('motion-ignores-reduced-preference', flag, motionAssertions(good), 'interaction', 'rendered-dom')
    return [
      { scenario: 'working', ...judge(css(good), [], ['reduced-motion']) },
      { scenario: 'incomplete', ...judge(motionAssertions(null), [], ['reduced-motion']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'conversion.loading-feedback': async () => {
    const key = 'mobile-loading-delay'
    const fast = await inspect('mobile-ux-quality', pageHtml(), metrics({ loadExperience: loading(800) }))
    const slow = await inspect('mobile-ux-quality', pageHtml(), metrics({ loadExperience: loading(5200) }))
    const missing = await inspect('mobile-ux-quality', pageHtml(), null)
    const failing = judge(slow.assertions, slow.flags, [key])
    const later = judge(fast.assertions, [], [key])
    if (!fast.assertions.some(assertion => assertion.key === key && assertion.passed && assertion.complete !== false)) throw new Error('Mobile loading clearance was not recorded')
    return [
      { scenario: 'working', ...later },
      { scenario: 'failing', ...failing },
      { scenario: 'incomplete', ...judge(missing.assertions, [], [key]) },
      { scenario: 'repaired', verdict: later.verdict, identity: failing.identity },
    ]
  },
  'conversion.input-zoom': () => heuristic('mobile-ux-quality', 'mobile-input-fonts', { captured: { inputsBelow16px: [{ selector: '#email', fontSize: 14 }] } }, 'metrics'),
  'conversion.button-placement': () => heuristic('mobile-ux-quality', 'mobile-cta-position', { captured: { mobilePrimaryCtaTopPx: 0 } }, 'metrics'),
  'conversion.cta-focus': () => heuristic('cta-focus', 'primary-action-count', { captured: { competingPrimaryCtaCount: 3, competingPrimaryCtaLabels: ['Start', 'Buy', 'Talk'] } }, 'metrics'),
  'conversion.value-proposition': () => heuristic('messaging-clarity', 'headline-outcome', { html: pageHtml('The ultimate platform') }, 'html'),
  'conversion.audience-language': () => heuristic('messaging-clarity', 'audience-or-outcome', { html: pageHtml('A brighter tomorrow') }, 'html'),
  'conversion.placeholder-copy': () => heuristic('slop', 'placeholder-patterns', { html: pageHtml(undefined, 'Lorem ipsum ' + PROSE) }, 'html'),
  'conversion.form-friction': async () => {
    const parsed = parseMetadataFromHtml(pageHtml(undefined, undefined, undefined, '<form><input name="email"><button>Get started free</button></form>'), PAGE)
    const many = await inspect('conversion-friction', pageHtml(), metrics(), { ...parsed, forms: 1, maxConversionFormInputs: 8 })
    const few = await inspect('conversion-friction', pageHtml(), metrics(), { ...parsed, forms: 1, maxConversionFormInputs: 2 })
    const open = await inspect('conversion-friction', pageHtml(), metrics(), { ...parsed, forms: 1, maxConversionFormInputs: undefined, totalFormInputs: 1 })
    const failing = judge(many.assertions, many.flags, ['conversion-field-count'])
    return [
      { scenario: 'working', ...judge(few.assertions, [], ['conversion-field-count']) },
      { scenario: 'failing', ...failing },
      { scenario: 'incomplete', ...judge(open.assertions, [], ['conversion-field-count']) },
      { scenario: 'repaired', ...judge(few.assertions, [], ['conversion-field-count']), identity: failing.identity },
    ]
  },
  'conversion.contact-privacy': () => {
    const meta = (privacy: boolean, contact: boolean) => parseMetadataFromHtml(pageHtml(undefined, undefined, undefined, `${privacy ? '<a href="/privacy">Privacy Policy</a>' : ''}${contact ? '' : ''}`).replace('hello@example.com', contact ? 'hello@example.com' : ''), PAGE)
    const good = publicTrustObservations(meta(true, true))
    const badMeta = meta(false, false)
    const bad = publicTrustObservations(badMeta)
    const flags = runTrustChecks(PAGE, badMeta)
    const failing = judge([bad['privacy-link'], bad['contact-information']], flags, ['privacy-link', 'contact-information'])
    const later = [good['privacy-link'], good['contact-information']]
    const certified = certifies('no-privacy-policy', flags.find(flag => flag.checkId === 'no-privacy-policy'), later, 'trust', 'original-html')
    return [
      { scenario: 'working', ...judge(later, [], ['privacy-link', 'contact-information']) },
      { scenario: 'failing', ...failing },
      { scenario: 'incomplete', verdict: 'unavailable', identity: failing.identity },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified },
      { scenario: 'recurring', verdict: failing.verdict, identity: failing.identity },
    ]
  },
  'conversion.claims': () => heuristic('trust-psychology', 'claim-support-signals', { html: pageHtml('The best platform') }, 'html'),
  'conversion.hierarchy': () => heuristic('visual-hierarchy', 'prominent-action-count', { captured: { competingPrimaryCtaCount: 2, competingPrimaryCtaLabels: ['Start', 'Buy'] } }, 'html'),
  'conversion.density': () => heuristic('visual-hierarchy', 'heading-word-count', { html: pageHtml(Array.from({ length: 40 }, (_, index) => 'word' + index).join(' '), PROSE, `<h2>${Array.from({ length: 30 }, (_, index) => 'section' + index).join(' ')}</h2><h2>${Array.from({ length: 30 }, (_, index) => 'detail' + index).join(' ')}</h2>`) }, 'html'),
  'conversion.visual-consistency': () => heuristic('visual-polish', 'font-family-count', { captured: { uniqueFontFamilies: 6, fontFamilySample: ['A', 'B', 'C', 'D', 'E', 'F'] } }, 'metrics'),
  'accounts.signup': () => accountFacts('signup'),
  'accounts.verification': () => accountFacts('verification'),
  'accounts.signed-in': () => accountFacts('signed_in'),
  'accounts.deletion': () => accountFacts('deletion'),
  'signup.confirmation': () => {
    const succeeded = concludeSafeFormAttempt({ disposition: 'SUCCEEDED', reason: 'success_criterion_observed', detail: { fieldCount: 2, cleanupStatus: 'succeeded' }, requestRefused: false })
    const refused = refuseSafeFormAdmission(null, { startUrl: FIXTURE.targetUrl, allowLocalhost: false, setupAdmitted: true })
    const unproven = concludeSafeFormAttempt({ disposition: 'SUCCEEDED', reason: 'success_criterion_observed', detail: { fieldCount: 2, cleanupStatus: 'not_started' }, requestRefused: false })
    if (succeeded.disposition !== 'SUCCEEDED' || refused?.reason !== 'fixture_not_authorized' || unproven.disposition === 'SUCCEEDED') throw new Error('Signup confirmation settlement changed')
    return [
      { scenario: 'working', verdict: 'observed', identity: 'signup:success_criterion_observed' },
      { scenario: 'failing', verdict: 'failed', identity: 'signup:fixture_not_authorized' },
      { scenario: 'incomplete', verdict: 'incomplete', identity: 'signup:fixture_cleanup_unproven' },
      { scenario: 'repaired', verdict: 'observed', identity: 'signup:success_criterion_observed' },
      { scenario: 'recurring', verdict: 'failed', identity: 'signup:fixture_not_authorized' },
    ]
  },
  'signup.fixture': () => {
    const changed = refuseSafeFormAdmission(FIXTURE, { startUrl: FIXTURE.targetUrl, allowLocalhost: false, setupAdmitted: true, expectedVersion: 2 })
    const httpFixture = { ...FIXTURE, targetUrl: 'http://example.com/signup', resetUrl: 'http://example.com/hooks/reset', cleanupUrl: 'http://example.com/hooks/cleanup' }
    const insecure = refuseSafeFormAdmission(httpFixture, { startUrl: httpFixture.targetUrl, allowLocalhost: false, setupAdmitted: true })
    if (admitted() !== null || changed?.reason !== 'fixture_changed' || insecure?.reason !== 'fixture_https_required') throw new Error('Signup fixture admission changed')
    return [
      { scenario: 'working', verdict: 'observed', identity: 'fixture:1' },
      { scenario: 'failing', verdict: 'failed', identity: 'fixture:fixture_changed' },
      { scenario: 'incomplete', verdict: 'incomplete', identity: 'fixture:fixture_https_required' },
      { scenario: 'repaired', verdict: 'observed', identity: 'fixture:1' },
      { scenario: 'recurring', verdict: 'failed', identity: 'fixture:fixture_changed' },
    ]
  },
  'signup.cleanup': () => {
    const clean = concludeSafeFormAttempt({ disposition: 'SUCCEEDED', reason: 'success_criterion_observed', detail: { fieldCount: 2, cleanupStatus: 'succeeded' }, requestRefused: false })
    const unproven = concludeSafeFormAttempt({ disposition: 'BLOCKED', reason: 'form_execution_failed', detail: { fieldCount: 2, cleanupStatus: 'not_started' }, requestRefused: false })
    const boundary = concludeSafeFormAttempt({ disposition: 'SUCCEEDED', reason: 'success_criterion_observed', detail: { fieldCount: 2, cleanupStatus: 'succeeded' }, requestRefused: true })
    if (clean.disposition !== 'SUCCEEDED' || unproven.reason !== 'fixture_cleanup_unproven' || boundary.reason !== 'fixture_boundary_refused') throw new Error('Signup cleanup settlement changed')
    return [
      { scenario: 'working', verdict: 'observed', identity: 'signup:cleanup_succeeded' },
      { scenario: 'failing', verdict: 'failed', identity: 'signup:fixture_cleanup_unproven' },
      { scenario: 'incomplete', verdict: 'incomplete', identity: 'signup:fixture_boundary_refused' },
      { scenario: 'repaired', verdict: 'observed', identity: 'signup:cleanup_succeeded' },
      { scenario: 'recurring', verdict: 'failed', identity: 'signup:fixture_cleanup_unproven' },
    ]
  },
  'signup.authorization': () => {
    const comparable = bindingEvidenceIsComparable({ environment: 'catalog', requiredBindings: ['signup'], bindings: [{ key: 'signup', version: 1, mechanism: 'SAFE_FORM', fixture: { id: 'fixture', version: 1 } }] }, { key: 'signup', version: 1, required: true, mechanism: 'SAFE_FORM', fixture: { id: 'fixture', version: 1, authorized: true } }, 'catalog')
    const unauthorized = refuseSafeFormAdmission({ ...FIXTURE, authorizedAt: null, lastDryRunVersion: null }, { startUrl: FIXTURE.targetUrl, allowLocalhost: false, setupAdmitted: true })
    const setup = refuseSafeFormAdmission(FIXTURE, { startUrl: FIXTURE.targetUrl, allowLocalhost: false, setupAdmitted: false, requireAuthorization: false })
    if (admitted() !== null || unauthorized?.reason !== 'fixture_not_authorized' || setup?.reason !== 'fixture_setup_not_admitted' || !comparable) throw new Error('Signup authorization changed')
    return [
      { scenario: 'working', verdict: 'observed', identity: 'fixture:authorized:1' },
      { scenario: 'failing', verdict: 'failed', identity: 'fixture:fixture_not_authorized' },
      { scenario: 'incomplete', verdict: 'incomplete', identity: 'fixture:fixture_setup_not_admitted' },
      { scenario: 'repaired', verdict: 'observed', identity: 'fixture:authorized:1' },
      { scenario: 'recurring', verdict: 'failed', identity: 'fixture:fixture_not_authorized' },
    ]
  },
  'security.https': () => {
    const good = securityObservations(PAGE, { images: [], resourceTransport: { version: 1, complete: true, inspected: 1, insecure: [] } })
    const bad = securityObservations('http://example.com/', null)
    const flags = runSecurityBasicsChecks('http://example.com/', null)
    const failing = judge(bad, flags, ['https'])
    const certified = certifies('no-https', flags[0], good, 'security', 'http')
    const admitted = normalizeAuditUrl('not a url')
    return [
      { scenario: 'working', ...judge(good, [], ['https']) },
      { scenario: 'incomplete', verdict: admitted.ok ? 'failed' : 'unavailable', identity: 'security:unadmitted' },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'security.mixed-content': () => {
    const transport = (insecure: Array<{ kind: string; url: string }>, complete = true) => ({ version: 1 as const, complete, inspected: 1, insecure })
    const good = securityObservations(PAGE, { images: [], resourceTransport: transport([]) })
    const bad = securityObservations(PAGE, { images: [], resourceTransport: transport([{ kind: 'script', url: 'http://cdn.example/app.js' }]) })
    const open = securityObservations(PAGE, { images: [], resourceTransport: transport([], false) })
    const flags = runSecurityBasicsChecks(PAGE, parseMetadataFromHtml('<html><body><script src="http://cdn.example/app.js"></script></body></html>', PAGE))
    const failing = judge(bad, flags.filter(flag => flag.checkId === 'security-mixed-content'), ['resource-transport'])
    const certified = certifies('security-mixed-content', flags.find(flag => flag.checkId === 'security-mixed-content') ?? { ...flags[0], checkId: 'security-mixed-content' }, good, 'security', 'http')
    return [
      { scenario: 'working', ...judge(good, [], ['resource-transport']) },
      { scenario: 'incomplete', ...judge(open, [], ['resource-transport']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'security.privacy': () => trustFacts('privacy-link', 'no-privacy-policy', pageHtml().replace('<a href="/privacy">Privacy Policy</a>', '')),
  'security.contact': () => trustFacts('contact-information', 'no-contact-info', pageHtml().replace('<a href="/contact">Contact</a>', '').replace('<p>hello@example.com</p>', '<p>No published address</p>')),
  'security.consent': () => {
    const analytics = '<html><head><script src="https://www.google-analytics.com/analytics.js"></script></head><body><p>Example</p></body></html>'
    const withConsent = parseMetadataFromHtml(analytics + '<button>Accept cookies</button>', PAGE)
    const without = parseMetadataFromHtml(analytics, PAGE)
    const incomplete = { ...without, renderedCopy: { version: 1 as const, pageUrl: PAGE, pageText: 'Example', h1s: [], h2s: [], complete: true, textTruncated: false, consentControls: [], consentControlsComplete: false } }
    const good = publicTrustObservations(withConsent)
    const bad = publicTrustObservations(without)
    const open = publicTrustObservations(incomplete)
    const flags = runTrustChecks(PAGE, without)
    const failing = judge([bad['cookie-consent-signals']], flags.filter(flag => flag.checkId === 'cookie-consent-absent'), ['cookie-consent-signals'])
    return [
      { scenario: 'working', ...judge([good['cookie-consent-signals']], [], ['cookie-consent-signals']) },
      { scenario: 'failing', ...failing },
      { scenario: 'incomplete', ...judge([open['cookie-consent-signals']], [], ['cookie-consent-signals']) },
      { scenario: 'repaired', verdict: 'observed', identity: failing.identity },
    ]
  },
  'security.csp': () => headerCase('content-security-policy', 'security-csp-missing', headersExcept(['content-security-policy']), null),
  'security.hsts': () => headerCase('hsts-duration', 'security-hsts-missing', headersExcept(['strict-transport-security']), { 'strict-transport-security': 'max-age=nope' }),
  'security.framing': () => headerCase('frame-protection', 'security-frame-options-missing', headersExcept(['x-frame-options'], { 'content-security-policy': "default-src 'self'; script-src 'self'; object-src 'none'" }), { 'content-security-policy': 'frame-ancestors ???' }),
  'security.content-type': () => headerCase('x-content-type-options', 'security-content-type-options-missing', headersExcept(['x-content-type-options']), null),
  'security.referrer': () => headerCase('referrer-policy', 'security-referrer-policy-missing', headersExcept(['referrer-policy']), { 'referrer-policy': 'not-a-policy' }),
  'security.cross-origin': () => {
    const keys = ['opener-policy', 'embedder-policy', 'resource-policy']
    const badHeaders = headersExcept(['cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy'])
    const good = securityHeaderObservations(PAGE, GOOD_HEADERS).filter(assertion => keys.includes(assertion.key))
    const bad = securityHeaderObservations(PAGE, badHeaders)
    const flags = runSecurityHeaderChecks(PAGE, badHeaders)
    const flag = flags.find(item => item.checkId === 'security-headers-hardening') ?? flags.find(item => item.checkId === 'security-coop-missing')
    const open = securityHeaderObservations(PAGE, { ...GOOD_HEADERS, 'cross-origin-opener-policy': '???', 'cross-origin-embedder-policy': '???', 'cross-origin-resource-policy': '???' }).filter(assertion => keys.includes(assertion.key))
    const failing = judge(bad.filter(assertion => keys.includes(assertion.key)), flag ? [flag] : [], keys)
    const certified = certifies(flag?.checkId ?? 'security-coop-missing', flag, securityHeaderObservations(PAGE, GOOD_HEADERS), 'security-headers', 'http')
    return [
      { scenario: 'working', ...judge(good, [], keys) },
      { scenario: 'incomplete', ...judge(open, [], keys) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'security.permissions': () => headerCase('permissions-policy', 'security-permissions-policy-missing', headersExcept(['permissions-policy']), { 'permissions-policy': 'camera=(' }),
  'security.cross-domain': () => headerCase('cross-domain-policy', 'security-x-permitted-cross-domain', { ...GOOD_HEADERS, 'x-permitted-cross-domain-policies': 'all' }, null),
  'performance.loading': () => labCase('score', 'perf-score-critical', 40),
  'performance.lcp': () => labCase('lcp', 'lcp-critical', 5000),
  'performance.cls': () => labCase('cls', 'cls-critical', 0.4),
  'performance.inp': () => {
    const read = (inp: number | null) => recordCheckObservations('performance', { url: PAGE, metadata: null, desktop: speed('desktop'), mobile: speed('mobile', { crux: { lcp: null, cls: null, fcp: null, inp, ttfb: null, formFactor: null, effectiveConnectionType: null, source: 'pagespeed-loading-experience', scope: 'page', url: PAGE, reportingWindowDays: 28 } }) }).filter(assertion => assertion.key === 'inp')
    const good = read(180), bad = read(800), missing = read(null)
    if (!good[0]?.observed.includes('180') || !bad[0]?.observed.includes('800') || good[0].disposition !== 'observed') throw new Error('INP observation did not retain the reporting window')
    return [
      { scenario: 'working', verdict: 'observed', identity: 'inp:180' },
      { scenario: 'failing', verdict: 'observed', identity: 'inp:800' },
      { scenario: 'incomplete', ...judge(missing, [], ['inp']) },
      { scenario: 'repaired', verdict: 'observed', identity: 'inp:180' },
      { scenario: 'recurring', verdict: 'observed', identity: 'inp:800' },
    ]
  },
  'performance.render-blocking': () => resourceCase('render-blocking', 'render-blocking', { id: 'render-blocking-resources', providerAuditId: 'render-blocking-resources', title: 'Render blocking', unit: 'ms', score: 0, savings: 800 }, 'render-blocking-resources'),
  'performance.unused-code': () => resourceCase('unused-javascript', 'unused-js-large', { id: 'unused-javascript', providerAuditId: 'unused-javascript', title: 'Unused JavaScript', unit: 'bytes', score: 0, savings: 200_000 }, 'unused-javascript'),
  'performance.images': () => resourceCase('image-optimization', 'unoptimized-images', { id: 'uses-optimized-images', providerAuditId: 'image-delivery-insight', title: 'Images', unit: 'bytes', score: 0, savings: 80_000 }, 'uses-optimized-images'),
  'performance.slow-visibility': () => slowFacts('meaningful-text', 'slow-3g-blank-screen', { timeToFirstTextMs: 30_000, timeToContentMs: 30_000, textBlankThroughMs: 9900, contentAbsentThroughMs: 9900, timeToCtaMs: 1000, ctaAbsentThroughMs: 0 }),
  'performance.blank-delayed': () => slowFacts('primary-action-visibility', 'slow-3g-cta-delayed', { timeToFirstTextMs: 1000, timeToContentMs: 1000, textBlankThroughMs: 0, timeToCtaMs: 9000, ctaAbsentThroughMs: 9000 }),
  'search.presentation': () => searchCase(['presentation'], ['title-missing', 'description-missing'], { working: PRESENTATION, failing: '<html><head></head><body></body></html>', incomplete: {} }),
  'search.headings': () => searchCase(['presentation'], ['h1-missing', 'h1-multiple'], { working: PRESENTATION, failing: '<html lang="en"><head><title>Example website title</title><meta name="description" content="A useful description of the example website for visitors."></head><body><p>No heading</p></body></html>', incomplete: {} }),
  'search.canonicals': () => searchCase(['canonical'], ['search-canonical-conflict', 'search-canonical-invalid', 'search-canonical-target'], { working: '<title>Example website title</title><link rel="canonical" href="https://example.com/">', failing: '<title>Page</title><link rel="canonical" href="/a"><link rel="canonical" href="/b"><link rel="canonical" href="javascript:bad">', incomplete: {}, failingOverrides: {}, goodOverrides: {} }),
  'search.indexing': () => searchCase(['indexing'], ['robots-blocks-indexing'], { working: PRESENTATION, failing: '<title>Page</title><meta name="robots" content="noindex">', incomplete: {}, failingOverrides: { sitemapUrls: [PAGE] } }),
  'search.robots': () => searchCase(['crawl'], ['search-crawl-access'], { working: PRESENTATION, failing: PRESENTATION, incomplete: { robots: document('server failure', { status: 503, url: PAGE + 'robots.txt', finalUrl: PAGE + 'robots.txt' }) }, failingOverrides: { robots: document('User-agent: *\nDisallow: /', { url: PAGE + 'robots.txt', finalUrl: PAGE + 'robots.txt' }) } }),
  'search.sitemaps': () => searchCase(['discovery'], ['sitemap-missing', 'search-sitemap-invalid'], { working: PRESENTATION, failing: PRESENTATION, incomplete: { sitemaps: [document(null, { url: PAGE + 'sitemap.xml', finalUrl: PAGE + 'sitemap.xml', status: 503, complete: false })], sitemapsComplete: false }, failingOverrides: { sitemaps: [document(null, { url: PAGE + 'sitemap.xml', finalUrl: PAGE + 'sitemap.xml', status: 404, complete: true })], declaredSitemaps: [PAGE + 'sitemap.xml'], sitemapUrls: [], sitemapsComplete: true }, goodOverrides: { sitemaps: [document('<urlset><url><loc>https://example.com/</loc></url></urlset>', { url: PAGE + 'sitemap.xml', finalUrl: PAGE + 'sitemap.xml', headers: { 'content-type': 'application/xml' } })], sitemapUrls: [PAGE], sitemapsComplete: true } }),
  'search.links': async () => {
    const linked = await searchObservations(PRESENTATION.replace('</body>', '<a href="https://example.com/pricing">Pricing</a></body>'), ['discovery'], { sitemapUrls: [PAGE], sitemapsComplete: true })
    const unlisted = await searchObservations(PRESENTATION, ['discovery'], { sitemapUrls: [], sitemapsComplete: true })
    const blocked = document('<html><body>Error</body></html>', { status: 403 })
    const incomplete = await searchObservations(undefined, ['discovery'], { original: blocked, rendered: blocked })
    const link = (items: SearchObservation[]) => items.find(item => item.checkId === 'search-discovery-links')
    const good = link(linked), bad = link(unlisted), open = link(incomplete)
    if (!good?.observed.includes('1 distinct') || !bad?.observed.includes('was not recorded') || good.disposition === 'passed') throw new Error('Discovery link observation changed')
    const listedReceipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'catalog', pageUrl: PAGE, collectedAt: evidence().collectedAt, complete: true, observations: linked })
    const recovery = bad ? assessSearchRecovery(listedReceipt, bad.checkId, bad.attention, PAGE) : { comparable: false, verdict: 'unknown' as const }
    const certified = recovery.comparable && recovery.verdict === 'passed'
    return [
      { scenario: 'working', verdict: 'observed', identity: 'search:search-discovery-links:listed' },
      { scenario: 'failing', verdict: 'observed', identity: 'search:search-discovery-links:unlisted' },
      { scenario: 'incomplete', verdict: open?.disposition === 'unknown' ? 'incomplete' : 'failed', identity: 'search:search-discovery-links:unknown' },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'unavailable', identity: 'search:search-discovery-links:unlisted', certified },
      { scenario: 'recurring', verdict: 'observed', identity: 'search:search-discovery-links:unlisted' },
    ]
  },
  'search.structured-data': async () => {
    const product = (price: string, id = '#product') => markup({ '@context': 'https://schema.org', '@type': 'Product', '@id': id, name: 'Example', offers: { '@type': 'Offer', price } }, '<h1>Example</h1>')
    const broken = await searchObservations(product('free'), ['structured-data'])
    const fixed = await searchObservations(product('12'), ['structured-data'])
    const moved = await searchObservations(product('12', '#other'), ['structured-data'])
    const blocked = document('<html><body>Error</body></html>', { status: 403 })
    const incomplete = await searchObservations(undefined, ['structured-data'], { original: blocked, rendered: blocked })
    const ids = ['search-structured-feature']
    const flag = searchFindings(broken).find(item => item.checkId === 'search-structured-feature')
    const failing = searchJudge(broken, ids)
    const receiptFor = (observations: SearchObservation[]) => searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'catalog', pageUrl: PAGE, collectedAt: evidence().collectedAt, complete: true, observations })
    const recovery = flag ? assessSearchRecovery(receiptFor(fixed), flag.checkId, flag.attentionPolicy, PAGE) : { comparable: false, verdict: 'unknown' as const }
    const changed = flag ? assessSearchRecovery(receiptFor(moved), flag.checkId, flag.attentionPolicy, PAGE) : { comparable: true, verdict: 'passed' as const }
    if (changed.comparable && changed.verdict === 'passed') throw new Error('Structured data repair accepted a different entity')
    const certified = recovery.comparable && recovery.verdict === 'passed'
    return [
      { scenario: 'working', ...searchJudge(fixed, ids) },
      { scenario: 'failing', ...failing },
      { scenario: 'incomplete', ...searchJudge(incomplete, ids) },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'unavailable', identity: failing.identity, certified },
      { scenario: 'recurring', verdict: failing.verdict, identity: failing.identity },
    ]
  },
  'search.open-graph': () => metadataCase(['preview-title-presence', 'preview-description-presence'], { ogTitle: '', ogDescription: '' }, { ogTitle: undefined, ogDescription: undefined }, 'og-title-missing'),
  'search.favicon': () => metadataCase(['favicon-presence'], { hasFavicon: false }, { hasFavicon: undefined }, 'favicon-missing'),
  'search.preview-image': async () => {
    const imageUrl = 'https://example.com/cover.png'
    const image = async (status: number, contentType: string, body = 'png') => ({ body, finalUrl: imageUrl, statusCode: status, headers: { 'content-type': contentType }, complete: true, redirects: [] as [] })
    const assertions: CheckAssertion[] = []
    const flags: DeterministicFlag[][] = []
    const run = async (ogImage: string | undefined, fetch?: () => Promise<{ body: string; finalUrl: string; statusCode: number; headers: Record<string, string>; complete: boolean; redirects: [] }>) => {
      const recorded: CheckAssertion[] = []
      const found = await runOgImageUrlCheck(PAGE, { ogImage }, { record: assertion => recorded.push(assertion), fetchDocument: fetch })
      return { recorded, found }
    }
    const good = await run(imageUrl, () => image(200, 'image/png'))
    const bad = await run(imageUrl, () => image(404, 'text/html', 'missing'))
    const open = await run(undefined)
    assertions.push(...good.recorded)
    flags.push(bad.found)
    const failing = judge(bad.recorded, bad.found, ['preview-image-response'])
    const certified = certifies('og-image-broken', bad.found[0], good.recorded, 'og-image', 'http')
    return [
      { scenario: 'working', ...judge(good.recorded, [], ['preview-image-response']) },
      { scenario: 'incomplete', ...judge(open.recorded, [], ['preview-image-response']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'search.preview-consistency': () => {
    const page = (url: string, title: string, description: string): CorridorPageMeta => ({ url, role: url === PAGE ? 'primary' : 'pricing', ogTitle: title, ogDescription: description, title, scope: { ...SCOPE, pageUrl: url, finalUrl: url }, source: 'native-head-v1', titleComplete: true, descriptionComplete: true })
    const distinct = evaluateCorridorConsistency([page(PAGE, 'Home offer', 'Home description for this site.'), page(PAGE + 'pricing', 'Pricing offer', 'Pricing description for this page.')])
    const shared = evaluateCorridorConsistency([page(PAGE, 'Same offer', 'Home description for this site.'), page(PAGE + 'pricing', 'Same offer', 'Pricing description for this page.')])
    const flat = (value: ReturnType<typeof evaluateCorridorConsistency>) => [...value.assertions.values()].flat()
    const failing = judge(flat(shared), shared.flags, ['preview-titles'])
    const certified = certifies('corridor-og-title-drift', shared.flags.find(flag => flag.checkId === 'corridor-og-title-drift'), flat(distinct), 'corridor', 'rendered-dom', PAGE + 'pricing')
    return [
      { scenario: 'working', ...judge(flat(distinct), [], ['preview-titles']) },
      { scenario: 'incomplete', verdict: evaluateCorridorConsistency([page(PAGE, 'Home', 'Home description')]).flags.length === 0 && flat(evaluateCorridorConsistency([page(PAGE, 'Home', 'Home description')])).length === 0 ? 'unavailable' : 'failed', identity: 'corridor:single-page' },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'search.google-indexing': () => googleCase('indexing-failure', { verdict: 'PASS', pageFetchState: 'SUCCESSFUL', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED' }, { verdict: 'FAIL', pageFetchState: 'SUCCESSFUL', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED' }, { verdict: 'PASS', pageFetchState: 'SOFT_404', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED' }),
  'search.google-soft404': () => googleCase('search-google-fetch', { verdict: 'PASS', pageFetchState: 'SUCCESSFUL', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED' }, { verdict: 'NEUTRAL', pageFetchState: 'SOFT_404', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED' }, { verdict: 'NEUTRAL' }),
  'search.google-declarations': () => googleCase('search-google-directives', { verdict: 'PASS', pageFetchState: 'SUCCESSFUL', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED' }, { verdict: 'NEUTRAL', pageFetchState: 'SUCCESSFUL', robotsTxtState: 'DISALLOWED', indexingState: 'INDEXING_ALLOWED' }, { verdict: 'NEUTRAL', pageFetchState: 'SUCCESSFUL' }),
  'search.google-ctr': () => {
    const row = (ctr: number) => ({ keys: ['query', PAGE], clicks: ctr === 0.01 ? 1 : 10, impressions: 100, ctr, position: 4 })
    const read = (ctr: number) => searchAnalyticsObservations({ pageUrl: PAGE, property: 'sc-domain:example.com', collectedAt: WHEN, dateRange: '2026-09-01 to 2026-10-01', rows: [row(ctr)] })
    const empty = searchAnalyticsObservations({ pageUrl: PAGE, property: 'sc-domain:example.com', collectedAt: WHEN, dateRange: '2026-09-01 to 2026-10-01', rows: [] })
    const good = read(0.1), bad = read(0.01)
    if (good.some(item => item.checkId === 'low-ctr') || !bad.some(item => item.checkId === 'low-ctr' && item.disposition === 'observed') || empty[0]?.reason !== 'bounded_search_rows_recorded') throw new Error('Search analytics observation changed')
    return [
      { scenario: 'working', verdict: 'observed', identity: 'analytics:ctr:0.1' },
      { scenario: 'failing', verdict: 'observed', identity: 'check:low-ctr' },
      { scenario: 'incomplete', verdict: 'unavailable', identity: 'search:bounded_search_rows_recorded' },
      { scenario: 'repaired', verdict: 'observed', identity: 'analytics:ctr:0.1' },
      { scenario: 'recurring', verdict: 'observed', identity: 'check:low-ctr' },
    ]
  },
  'tracking.page-tags': () => trackingMarkup(true),
  'tracking.markup': () => trackingMarkup(true),
  'tracking.absence': () => trackingMarkup(false),
  'tracking.tools': () => {
    const key = 'a'.repeat(64)
    const evidenceFor = (status: number | null): TrackingEvidence => ({ version: 1, phase: 'page_load', truncated: false, durationMs: 500, consentInteraction: 'none', captureKey: key, requests: status === null ? [] : [{ provider: 'plausible', role: 'library', hostname: 'plausible.io', endpoint: '/js/script.js', method: 'GET', phase: 'page_load', state: status < 400 ? 'completed' : 'failed', status, reason: null, atMs: 20, requestKey: key }] })
    const meta = parseMetadataFromHtml('<html><head><script src="https://plausible.io/js/script.js"></script></head><body></body></html>', PAGE)
    const good = runTrackingChecks(meta, evidenceFor(200), PAGE)
    const bad = runTrackingChecks(meta, evidenceFor(500), PAGE)
    const open = runTrackingChecks(meta, undefined, PAGE)
    const failing = judge(bad.assertions, bad.flags, ['tracking-library'])
    const certified = certifies('tracking-library-http-error', bad.flags.find(flag => flag.checkId === 'tracking-library-http-error'), good.assertions, 'measurement', 'browser-network')
    return [
      { scenario: 'working', ...judge(good.assertions, [], ['tracking-library']) },
      { scenario: 'incomplete', ...judge(open.assertions, [], ['tracking-initiation']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'tracking.audience': () => {
    const read = (sessions: number | null) => factsFromAnalyticsAudience({ sessions: sessions ?? undefined, activeUsers: sessions ?? undefined, pageViews: sessions ?? undefined }, AUDIENCE)
    const good = read(12), zero = read(0), missing = read(null)
    if (good[0]?.sessions !== 12 || zero[0]?.sessions !== 0 || missing.length !== 0) throw new Error('Analytics audience fact changed')
    const lines = contextLinesForPage([{ ...good[0], pagePath: null }], PAGE)
    void lines
    return [
      { scenario: 'working', verdict: 'observed', identity: 'analytics:sessions:12' },
      { scenario: 'failing', verdict: 'observed', identity: 'analytics:sessions:0' },
      { scenario: 'incomplete', verdict: 'unavailable', identity: 'analytics:sessions:unavailable' },
      { scenario: 'repaired', verdict: 'observed', identity: 'analytics:sessions:12' },
      { scenario: 'recurring', verdict: 'observed', identity: 'analytics:sessions:0' },
    ]
  },
  'tracking.page-traffic': () => {
    const read = (pageViews: number | null) => factsFromAnalyticsRows([{ pagePath: '/', sessions: pageViews ?? undefined, pageViews: pageViews ?? undefined }], AUDIENCE)
    const good = read(12), zero = read(0), missing = factsFromAnalyticsRows([{ pagePath: '/', sessions: undefined, pageViews: undefined }], AUDIENCE)
    if (good[0]?.pageViews !== 12 || zero[0]?.pageViews !== 0 || zero[0]?.sessions === 0 && zero[0]?.pageViews !== 0 || missing.some(fact => fact.pageViews === 0 || fact.sessions === 0)) throw new Error('Analytics page traffic relabeled a count')
    const lines = contextLinesForPage(good, PAGE)
    if (!lines.length) throw new Error('Analytics page lines were not kept for the measured host')
    return [
      { scenario: 'working', verdict: 'observed', identity: 'analytics:pageViews:12' },
      { scenario: 'failing', verdict: 'observed', identity: 'analytics:pageViews:0' },
      { scenario: 'incomplete', verdict: missing.length === 0 || missing.every(fact => fact.pageViews == null && fact.sessions == null) ? 'unavailable' : 'failed', identity: 'analytics:pageViews:unavailable' },
      { scenario: 'repaired', verdict: 'observed', identity: 'analytics:pageViews:12' },
      { scenario: 'recurring', verdict: 'observed', identity: 'analytics:pageViews:0' },
    ]
  },
  'accessibility.names': () => axeCase('button-name', 'buttons-no-text'),
  'accessibility.labels': () => axeCase('label', 'form-inputs-no-label'),
  'accessibility.skip-links': () => axeCase('bypass', 'skip-link-missing'),
  'accessibility.targets': () => axeCase('target-size', 'axe-target-size'),
  'accessibility.alt': () => axeCase('image-alt', 'images-missing-alt'),
  'accessibility.contrast': () => axeCase('color-contrast', 'color-contrast-poor'),
  'accessibility.language': () => axeCase('html-has-lang', 'axe-html-has-lang'),
  'accessibility.structure': () => axeCase('heading-order', 'heading-order-skipped'),
  'accessibility.aria': () => axeCase('aria-required-children', 'axe-aria-required-children'),
  'accessibility.identifiers': () => axeCase('duplicate-id-aria', 'axe-duplicate-id-aria'),
  'accessibility.landmarks': () => axeCase('landmark-one-main', 'axe-landmark-one-main'),
  'accessibility.viewport': () => axeCase('meta-viewport', 'axe-meta-viewport'),
  'accessibility.traps': () => keyboardFacts('trap'),
  'accessibility.focus': () => keyboardFacts('focus'),
  'accessibility.tab-order': () => keyboardFacts('order').filter(fact => fact.scenario !== 'recurring'),
  'uptime.response': async () => {
    const read = (status: number) => probeUptime(PAGE, async () => ({ body: 'ok', finalUrl: PAGE, statusCode: status, headers: {}, complete: true, redirects: [] }))
    const good = await read(200), bad = await read(500), blocked = await read(403)
    const opened = uptimeTransition({ result: bad.result, now: NOW, confirmation: true, pendingFailureAt: new Date(NOW.getTime() - 30_000), incidentOpen: false })
    const recovered = uptimeTransition({ result: good.result, now: NOW, confirmation: false, pendingFailureAt: null, incidentOpen: true })
    const unknown = uptimeTransition({ result: blocked.result, now: NOW, confirmation: false, pendingFailureAt: null, incidentOpen: true })
    const certified = bad.result === 'FAILED' && good.finalUrl === PAGE && opened.event === 'opened' && recovered.event === 'recovered' && unknown.event === null
    const failingIdentity = 'uptime:response_error'
    return [
      { scenario: 'working', verdict: good.result === 'ONLINE' ? 'passed' : 'failed', identity: 'uptime:response_received' },
      { scenario: 'failing', verdict: bad.result === 'FAILED' ? 'failed' : 'observed', identity: failingIdentity },
      { scenario: 'incomplete', verdict: blocked.result === 'UNKNOWN' ? 'incomplete' : 'failed', identity: 'uptime:' + blocked.reason },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'observed', identity: failingIdentity, certified },
      { scenario: 'recurring', verdict: 'failed', identity: failingIdentity },
    ]
  },
  'uptime.errors': async () => {
    const clean = await probeUptime(PAGE, async () => ({ body: 'ok', finalUrl: PAGE, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    const missing = await probeUptime(PAGE, async () => { throw new AuditUrlError('missing host', 'DNS_NOT_FOUND') })
    const unverified = classifyPublicRequestFailure(new AuditUrlError('resolver', 'DNS_UNAVAILABLE'))
    if (clean.result !== 'ONLINE' || missing.reason !== 'dns_failure' || unverified.reason !== 'public_target_unverified') throw new Error('Uptime error classification changed')
    const opened = uptimeTransition({ result: missing.result, now: NOW, confirmation: true, pendingFailureAt: new Date(NOW.getTime() - 30_000), incidentOpen: false })
    const recovered = uptimeTransition({ result: clean.result, now: NOW, confirmation: false, pendingFailureAt: null, incidentOpen: true })
    const unknown = uptimeTransition({ result: unverified.result, now: NOW, confirmation: false, pendingFailureAt: null, incidentOpen: true })
    const certified = missing.result === 'FAILED' && clean.finalUrl === PAGE && opened.event === 'opened' && recovered.event === 'recovered' && unknown.event === null
    const failingIdentity = 'uptime:dns_failure'
    return [
      { scenario: 'working', verdict: 'passed', identity: 'uptime:response_received' },
      { scenario: 'failing', verdict: 'failed', identity: failingIdentity },
      { scenario: 'incomplete', verdict: unverified.result === 'UNKNOWN' ? 'incomplete' : 'failed', identity: 'uptime:public_target_unverified' },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'observed', identity: failingIdentity, certified },
      { scenario: 'recurring', verdict: 'failed', identity: failingIdentity },
    ]
  },
  'uptime.provenance': async () => {
    const sameUrl = await probeUptime(PAGE, async () => ({ body: 'ok', finalUrl: PAGE, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    const drifted = await probeUptime(PAGE, async () => ({ body: 'ok', finalUrl: 'https://example.com/moved', statusCode: 200, headers: {}, complete: true, redirects: [] }))
    const unavailable = await probeUptime(PAGE, async () => { throw new Error('socket') })
    const restored = await probeUptime(PAGE, async () => ({ body: 'ok', finalUrl: PAGE, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    if (sameUrl.finalUrl !== PAGE || drifted.finalUrl === PAGE || unavailable.finalUrl !== null || restored.finalUrl !== PAGE) throw new Error('Uptime provenance changed')
    const opened = uptimeTransition({ result: drifted.result, now: NOW, confirmation: true, pendingFailureAt: new Date(NOW.getTime() - 30_000), incidentOpen: false })
    const recovered = uptimeTransition({ result: restored.result, now: NOW, confirmation: false, pendingFailureAt: null, incidentOpen: opened.event === 'opened' })
    const certified = opened.event === 'opened' && recovered.event === 'recovered'
    return [
      { scenario: 'working', verdict: 'passed', identity: 'uptime:final:' + sameUrl.finalUrl },
      { scenario: 'failing', verdict: 'observed', identity: 'uptime:final:https://example.com/moved' },
      { scenario: 'incomplete', verdict: 'unavailable', identity: 'uptime:final:null' },
      { scenario: 'repaired', verdict: certified ? 'passed' : 'observed', identity: 'uptime:final:https://example.com/moved', certified },
      { scenario: 'recurring', verdict: 'observed', identity: 'uptime:final:https://example.com/moved' },
    ]
  },
  'uptime.console': () => {
    const coverage = (errors: number, complete = true) => ({ phase: 'page_load' as const, pageUrl: PAGE, access: 'public', messagesTruncated: false, desktop: { complete, finalUrl: PAGE, profile: 'native', errors, observedMs: 3000, minimumMs: 2000 }, mobile: { complete, finalUrl: PAGE, profile: 'native', errors, observedMs: 3000, minimumMs: 2000 } })
    const clean = consoleObservations(coverage(0))
    const noisy = coverage(3)
    const messages = [{ type: 'error', text: 'first failure' }, { type: 'error', text: 'second failure' }, { type: 'error', text: 'third failure' }]
    const flags = runConsoleChecks(messages, noisy)
    const failing = judge(consoleObservations(noisy), flags, ['console-errors'])
    const certified = certifies(flags[0]?.checkId ?? 'console-errors-critical', flags[0], clean, 'console', 'browser-console')
    const partial = consoleObservations(coverage(0, false))
    return [
      { scenario: 'working', ...judge(clean, [], ['console-errors']) },
      { scenario: 'incomplete', ...judge(partial, [], ['console-errors']) },
      ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
    ]
  },
  'uptime.schedule': () => transitionFacts('schedule'),
  'uptime.incidents': () => transitionFacts('incidents'),
  'uptime.history': () => {
    const onlineAt = [-25, -20, -15, -10, -5, -1].map(minutes => uptimeProbe(new Date(NOW.getTime() + minutes * 60_000).toISOString(), 'ONLINE', true))
    const failedAt = uptimeProbe(new Date(NOW.getTime() - 45 * 60_000).toISOString(), 'FAILED', true)
    const online = uptimeTimeline(onlineAt, NOW)
    const offline = uptimeTimeline([failedAt], NOW)
    const both = uptimeTimeline([...onlineAt, failedAt], NOW)
    const empty = uptimeTimeline([], NOW)
    if (!online.some(segment => segment.state === 'online') || !offline.some(segment => segment.state === 'offline') || !empty.every(segment => segment.state === 'unknown')) throw new Error('Uptime timeline changed')
    return [
      { scenario: 'working', verdict: 'observed', identity: 'uptime:segment:online' },
      { scenario: 'failing', verdict: 'failed', identity: 'uptime:segment:offline' },
      { scenario: 'incomplete', verdict: 'incomplete', identity: 'uptime:segment:unknown' },
      { scenario: 'repaired', verdict: both.some(segment => segment.state === 'online') ? 'transition' : 'failed', identity: 'uptime:segment:online' },
      { scenario: 'recurring', verdict: 'failed', identity: 'uptime:segment:offline' },
    ]
  },
  'uptime.recovery': () => transitionFacts('recovery'),
}

function metadataCase(keys: string[], failing: RuntimeHeadMetadata, incomplete: RuntimeHeadMetadata, checkId: string): Fact[] {
  const head = (overrides: RuntimeHeadMetadata): RuntimeHeadMetadata => ({ title: 'Acme reports for developers', description: 'Acme reports help developers prepare useful evidence for their teams and customers.', ogTitle: 'Acme reports for developers', ogDescription: 'Acme reports help developers prepare useful evidence for their teams and customers.', ogImage: PAGE + 'cover.png', hasFavicon: true, viewport: 'width=device-width', lang: 'en', ...overrides })
  const read = (overrides: RuntimeHeadMetadata) => { const assertions: CheckAssertion[] = []; const flags = runMetadataChecks(head(overrides), assertion => assertions.push(assertion)); return { assertions, flags } }
  const good = read({})
  const bad = read(failing)
  const open = read(incomplete)
  const failingJudge = judge(bad.assertions, bad.flags.filter(flag => flag.checkId === checkId), keys)
  const certified = certifies(checkId, bad.flags.find(flag => flag.checkId === checkId), good.assertions, 'metadata', 'original-html')
  return [
    { scenario: 'working', ...judge(good.assertions, [], keys) },
    { scenario: 'incomplete', ...judge(open.assertions, [], keys) },
    ...pair(failingJudge, { verdict: certified ? 'passed' : 'observed', identity: failingJudge.identity, certified }, []),
  ]
}
function googleCase(checkId: string, good: Record<string, string>, bad: Record<string, string>, open: Record<string, string>): Fact[] {
  const read = (status: Record<string, string>) => googleIndexObservations({ pageUrl: PAGE, property: 'sc-domain:example.com', collectedAt: WHEN, status })
  const healthy = read(good).filter(item => item.checkId === checkId)
  const failed = read(bad).filter(item => item.checkId === checkId)
  const unknown = read(open).filter(item => item.checkId === checkId)
  const failing = searchJudge(failed, [checkId])
  return [
    { scenario: 'working', ...searchJudge(healthy, [checkId]) },
    { scenario: 'failing', ...failing },
    { scenario: 'incomplete', ...searchJudge(unknown, [checkId]) },
    { scenario: 'repaired', verdict: 'observed', identity: failing.identity },
    { scenario: 'recurring', verdict: failing.verdict, identity: failing.identity },
  ]
}
function trackingMarkup(presenceIsWorking: boolean): Fact[] {
  const present = parseMetadataFromHtml('<html><head><script src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script></head><body></body></html>', PAGE)
  const absent = parseMetadataFromHtml('<html><head><title>Example</title></head><body></body></html>', PAGE)
  const good = runTrackingChecks(present, undefined, PAGE)
  const bad = runTrackingChecks(absent, undefined, PAGE)
  const open = runTrackingChecks(null, undefined, PAGE)
  const failing = judge(bad.assertions, bad.flags, ['analytics-markup'])
  const certified = certifies('measurement-ga-gtm-posthog-missing', bad.flags[0], good.assertions, 'measurement', 'original-html')
  const working = presenceIsWorking ? judge(good.assertions, [], ['analytics-markup']) : { verdict: 'observed' as const, identity: failing.identity }
  if (!presenceIsWorking && bad.flags.some(flag => flag.checkId === 'measurement-ga-gtm-posthog-missing') && good.flags.some(flag => flag.checkId === 'measurement-ga-gtm-posthog-missing')) throw new Error('Markup presence still reported absence')
  return [
    { scenario: 'working', ...working },
    { scenario: 'incomplete', ...judge(open.assertions, [], ['analytics-markup']) },
    ...pair(failing, { verdict: certified ? 'passed' : 'observed', identity: failing.identity, certified }, []),
  ]
}
function slowFacts(key: string, checkId: string, failing: Partial<SlowReplayResult>): Fact[] {
  const base: SlowReplayResult = { profile: SLOW_REPLAY_PROFILE, navigationComplete: true, scope: { pageUrl: PAGE, finalUrl: PAGE, profile: 'mobile-native-fixture', access: 'public' }, timeToFirstTextMs: 1000, timeToCtaMs: 1000, timeToContentMs: 1000, textBlankThroughMs: 0, ctaAbsentThroughMs: 0, observedForMs: 9900, screenshotUrls: [], contentAbsentThroughMs: 0 }
  const action = checkId === 'slow-3g-cta-delayed' ? { selector: '#original', label: 'Get started', context: JSON.stringify({ profile: SLOW_REPLAY_PROFILE, pageUrl: PAGE, href: PAGE + 'start' }) } : null
  const timed = (input: Partial<SlowReplayResult>): SlowReplayResult => {
    const merged = { ...base, ...input }
    return action ? { ...merged, actions: [{ ...action, timeToVisibleMs: merged.timeToCtaMs, absentThroughMs: merged.ctaAbsentThroughMs ?? 0 }] } : merged
  }
  const bad = runSlowReplayChecks(timed(failing))
  const goodResult = timed({})
  const good = slowReplayAssertions(goodResult)
  const badAssertions = slowReplayAssertions(timed(failing))
  const failingJudge = judge(badAssertions, bad.filter(flag => flag.checkId === checkId), [key])
  const certified = certifies(checkId, bad.find(flag => flag.checkId === checkId), good, 'slow-replay', 'rendered-dom')
  const restricted = slowReplayAssertions({ ...base, restricted: true })
  return [
    { scenario: 'working', ...judge(good, [], [key]) },
    { scenario: 'incomplete', ...judge(restricted, [], [key]) },
    ...pair(failingJudge, { verdict: certified ? 'passed' : 'observed', identity: failingJudge.identity, certified }, []),
  ]
}

function accepted(entry: AdvertisedCoverage, fact: Fact): Verdict {
  if (fact.scenario === 'repaired' && entry.acceptance.recovery !== 'comparable_observation' && fact.verdict === 'passed') {
    return entry.acceptance.recovery === 'scheduled_transition' ? 'transition' : 'observed'
  }
  return fact.verdict
}

describe('advertised catalog evidence', () => {
  it('records a real observation for every advertised capability', async () => {
    const problems: string[] = []
    const covered = new Set(Object.keys(handlers))
    for (const entry of ADVERTISED_COVERAGE) {
      if (!covered.has(entry.id)) {
        problems.push(`${entry.id} has no evaluator call`)
        console.info(`catalog ${entry.id} missing`)
        continue
      }
      let facts: Fact[]
      try { facts = await handlers[entry.id]() } catch (error) {
        problems.push(`${entry.id} threw ${error instanceof Error ? error.message : String(error)}`)
        console.info(`catalog ${entry.id} error`)
        continue
      }
      const printed = facts.map(fact => ({ ...fact, verdict: accepted(entry, fact) }))
      for (const scenario of entry.acceptance.scenarios) {
        const fact = printed.find(item => item.scenario === scenario)
        if (!fact) { problems.push(`${entry.id} missing ${scenario}`); continue }
        if (scenario === 'working' && !['passed', 'observed'].includes(fact.verdict)) problems.push(`${entry.id} working ${fact.verdict}`)
        if (scenario === 'failing' && !['failed', 'observed'].includes(fact.verdict)) problems.push(`${entry.id} failing ${fact.verdict}`)
        if (scenario === 'incomplete' && !['incomplete', 'unavailable'].includes(fact.verdict)) problems.push(`${entry.id} incomplete ${fact.verdict}`)
        if (scenario === 'repaired' && entry.acceptance.recovery === 'scheduled_transition' && fact.verdict !== 'transition') problems.push(`${entry.id} repaired ${fact.verdict}`)
        if (scenario === 'repaired' && entry.acceptance.recovery !== 'comparable_observation' && fact.verdict === 'passed') problems.push(`${entry.id} repaired passed`)
        if (scenario === 'repaired' && entry.acceptance.recovery === 'comparable_observation' && fact.verdict === 'passed' && !fact.certified) problems.push(`${entry.id} repaired passed without certification`)
        if (scenario === 'recurring') {
          const failing = printed.find(item => item.scenario === 'failing')
          if (!fact.identity || fact.identity !== failing?.identity) problems.push(`${entry.id} recurrence ${fact.identity} ${failing?.identity ?? ''}`)
        }
      }
      const failing = printed.find(fact => fact.scenario === 'failing')
      const external = entry.acceptance.proofEnvironments.filter(environment => environment !== 'local_worker')
      console.info(`catalog ${entry.id} ${printed.map(fact => `${fact.scenario}=${fact.verdict}`).join(' ')} external=${external.join(',') || 'none'} identity=${failing?.identity ?? 'none'}`)
    }
    for (const id of covered) if (!ADVERTISED_COVERAGE.some(entry => entry.id === id)) problems.push(`${id} is not advertised`)
    expect(problems).toEqual([])
  }, 60_000)
})
