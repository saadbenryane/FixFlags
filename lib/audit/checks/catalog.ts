import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { detectPagePurpose } from '../page-purpose'
import { PAGE_CHECK_DEFINITIONS, type PageCheckDefinition } from './definitions'
import { runMetadataChecks, runOgImageUrlCheck } from './metadata-checks'
import { runPerformanceChecks } from './performance'
import type { AxeViolation } from './accessibility'
import { runSeoChecks } from './seo'
import { runTrustChecks } from './trust'
import { consoleObservations, runConsoleChecks } from './console'
import type { ConsoleCoverage } from '../console-evidence'
import type { AccessibilityEvidence } from '../browser/accessibility-evidence'
import type { CaptureObservationScope } from '../browser/observation-scope'
import { evaluateAccessibility } from './accessibility-observations'
import { runMobileChecks } from './mobile'
import { runContentChecks } from './content'
import { runSlopChecks } from './slop'
import { runLayoutChecks } from './layout'
import { runInteractionChecks } from './interaction'
import { runTrackingChecks } from './tracking'
import type { TrackingEvidence } from '../tracking/contracts'
import { runSecurityBasicsChecks } from './security'
import { RESOURCE_TRANSPORT_SCOPE } from '../resource-transport'
import { runSecurityHeaderChecks } from './security-headers'
import { runVisualPolishChecks } from './visual-polish'
import { runCtaFocusChecks } from './cta-focus'
import { runAuthCheckoutChecks } from './auth-checkout'
import { runMessagingClarityChecks } from './messaging-clarity'
import { runConversionFrictionChecks } from './conversion-friction'
import { runTrustPsychologyChecks } from './trust-psychology'
import { runVisualHierarchyChecks } from './visual-hierarchy'
import { runMobileUXQualityChecks } from './mobile-ux-quality'
import { runKeyboardChecks } from './keyboard'
import type { KeyboardEvidence } from '../browser/keyboard-probe'
import type { PublicDocument } from '../search/contracts'
import { assessPageResponse } from './page-response'
import { RENDERED_COPY_MODULES, RENDERED_COPY_LIMITATION, type RenderedCopy } from '../browser/rendered-copy'
import type { HeadMetadataObservation } from './head-metadata'
import type { DestinationCheckOptions } from './destination-evidence'

export type PageCheckContext = {
  url: string; metadata: PageMetadata | null; desktop: PageSpeedResult | null; mobile: PageSpeedResult | null;
  consoleErrors: Array<{ type: string; text: string }>; metrics?: CaptureMetrics | null;
  consoleCoverage?: ConsoleCoverage;
  head?: HeadMetadataObservation;
  renderedCopy?: RenderedCopy | null; accessibilityEvidence?: AccessibilityEvidence; renderedScope?: CaptureObservationScope;
  headers?: Record<string, string> | null; axe?: AxeViolation[];
  keyboard?: KeyboardEvidence; tracking?: TrackingEvidence;
  publicDocument?: PublicDocument;
  deadline?: number;
  destinations?: Pick<DestinationCheckOptions, 'fetchDocument' | 'openDestination' | 'collectedAt'>;
  scope: { complete?: boolean; limitation?: string; collectedAt?: string };
  purpose: ReturnType<typeof detectPagePurpose>; record(assertion: CheckAssertion): void;
}
type Evaluator = { id: string; evaluate(input: PageCheckContext): DeterministicFlag[] | Promise<DeterministicFlag[]> }
/** Only registrations that consume whole-document fields require parsed metadata. */
function withMetadata(evaluate: (input: PageCheckContext & { metadata: PageMetadata }) => ReturnType<Evaluator['evaluate']>): Evaluator['evaluate'] {
  return input => {
    if (!input.metadata) throw new Error('Page metadata is unavailable')
    return evaluate({ ...input, metadata: input.metadata })
  }
}
export function registerPageEvaluators(evaluators: Evaluator[], definitions = PAGE_CHECK_DEFINITIONS) {
  const registered = new Map<string, Evaluator & { definition: PageCheckDefinition }>()
  for (const evaluator of evaluators) {
    const definition = definitions[evaluator.id]
    if (registered.has(evaluator.id) || typeof evaluator.evaluate !== 'function' || !definition ||
      definition.evaluator !== evaluator.id || definition.resultSchema !== 'site-module-check-v1')
      throw new Error('Invalid page check registration: ' + evaluator.id)
    registered.set(evaluator.id, { ...evaluator, definition, evaluate(input) {
      if (RENDERED_COPY_MODULES.has(evaluator.id) && (input.metadata?.renderedCopy !== undefined || evaluator.id === 'visual-hierarchy' && !input.metadata)) {
        input.scope.limitation = RENDERED_COPY_LIMITATION
        const copy = input.metadata ? input.metadata.renderedCopy : input.renderedCopy
        if (!copy?.complete) { input.scope.complete = false; if (evaluator.id !== 'visual-hierarchy') return [] }
      }
      return evaluator.evaluate(input)
    } })
  }
  for (const id of Object.keys(definitions)) if (!registered.has(id)) throw new Error('Missing page check evaluator: ' + id)
  return registered
}

export const PAGE_CHECKS = registerPageEvaluators([
  { id: 'page-response', evaluate: c => {
    const checked = assessPageResponse(c.url, c.publicDocument)
    checked.assertions.forEach(c.record)
    Object.assign(c.scope, { complete: checked.complete, limitation: checked.limitation, collectedAt: checked.collectedAt })
    return checked.flags
  } },
  { id: 'metadata', evaluate: c => {
    const metadata = c.head?.metadata ?? c.metadata
    if (!metadata) throw new Error('Page head metadata is unavailable')
    return runMetadataChecks(metadata, c.record)
  } },
  { id: 'og-image', evaluate: c => {
    const metadata = c.head ? { ogImage: c.head.metadata.ogImage, linkBaseUrl: c.metadata?.linkBaseUrl } : c.metadata
    if (!metadata) throw new Error('Page head metadata is unavailable')
    // Older captures retained relative declarations without their document base.
    // A current parsed base can resolve them; the page URL cannot invent it.
    if (c.head && metadata.ogImage && !metadata.linkBaseUrl && !/^[a-z][a-z0-9+.-]*:/i.test(metadata.ogImage)) metadata.ogImage = undefined
    return runOgImageUrlCheck(c.url, metadata, { ...c.destinations, record: c.record, scope: c.scope, deadline: c.deadline })
  } },
  { id: 'accessibility', evaluate: c => {
    const checked = evaluateAccessibility({ metadata: c.metadata, evidence: c.accessibilityEvidence, scope: c.renderedScope,
      axe: c.axe, pagespeed: c.desktop ?? c.mobile })
    checked.assertions.forEach(c.record)
    Object.assign(c.scope, { complete: checked.complete, limitation: checked.limitation })
    return checked.flags
  } },
  { id: 'keyboard', evaluate: c => c.keyboard ? runKeyboardChecks(c.keyboard).flags : [] },
  { id: 'seo', evaluate: withMetadata(c => runSeoChecks(c.url, c.metadata, { renderedScope: c.renderedScope, record: c.record, scope: c.scope })) },
  { id: 'trust', evaluate: withMetadata(c => runTrustChecks(c.url, c.metadata)) },
  { id: 'console', evaluate: c => { Object.assign(c.scope, { complete: consoleObservations(c.consoleCoverage).every(assertion => assertion.complete === true),
      limitation: 'Console inspection covers the recorded desktop and mobile page-load windows, not later actions or all execution states.' });
    return runConsoleChecks(c.consoleErrors, c.consoleCoverage) } },
  { id: 'content', evaluate: withMetadata(c => runContentChecks(c.metadata, c.purpose, c.record)) },
  { id: 'slop', evaluate: withMetadata(c => runSlopChecks(c.metadata, c.record)) },
  { id: 'measurement', evaluate: c => { const checked = runTrackingChecks(c.metadata, c.tracking, c.url);
    checked.assertions.forEach(c.record); Object.assign(c.scope, { complete: checked.complete, limitation: checked.limitation }); return checked.flags } },
  { id: 'auth-checkout', evaluate: withMetadata(c => runAuthCheckoutChecks(c.url, c.metadata, { ...c.destinations, record: c.record, scope: c.scope, deadline: c.deadline })) },
  { id: 'security', evaluate: c => {
    Object.assign(c.scope, { complete: new URL(c.url).protocol !== 'https:' || c.metadata?.resourceTransport?.complete === true,
      limitation: RESOURCE_TRANSPORT_SCOPE })
    return runSecurityBasicsChecks(c.url, c.metadata)
  } },
  { id: 'security-headers', evaluate: c => runSecurityHeaderChecks(c.url, c.headers ?? null) },
  { id: 'messaging-clarity', evaluate: withMetadata(c => runMessagingClarityChecks(c.metadata, c.record)) },
  { id: 'conversion-friction', evaluate: withMetadata(c => runConversionFrictionChecks(c.metadata, c.purpose, c.record)) },
  { id: 'trust-psychology', evaluate: withMetadata(c => runTrustPsychologyChecks(c.metadata, c.purpose, c.url, c.record)) },
  { id: 'performance', evaluate: c => runPerformanceChecks(c.desktop, c.mobile, c.url) },
  { id: 'mobile', evaluate: c => runMobileChecks(c.mobile, c.url) },
  { id: 'mobile-ux-quality', evaluate: c => {
    if (!c.metadata) c.scope.complete = false
    return runMobileUXQualityChecks(c.metrics ?? null, c.metadata ? c.purpose.purpose : null, c.record)
  } },
  { id: 'layout', evaluate: c => {
    if (!c.metadata) c.scope.complete = false
    return runLayoutChecks(c.metrics ?? null, c.metadata ? c.purpose.purpose : null, c.record)
  } },
  { id: 'interaction', evaluate: c => runInteractionChecks(c.metrics ?? null, c.record) },
  { id: 'cta-focus', evaluate: c => runCtaFocusChecks(c.metrics ?? null, c.record) },
  { id: 'visual-polish', evaluate: c => runVisualPolishChecks(c.metrics ?? null, c.record) },
  { id: 'visual-hierarchy', evaluate: c => runVisualHierarchyChecks(c.metadata, c.metrics ?? null, c.record, c.renderedCopy) },
])

export function pageCheckApplicable(definition: PageCheckDefinition, input: PageCheckContext) {
  return definition.input === 'http' ? Boolean(input.publicDocument) : definition.input === 'console' ? Boolean(input.consoleCoverage || input.consoleErrors.length) : definition.input === 'keyboard' ? Boolean(input.keyboard?.candidateCount) : definition.input === 'performance' ? Boolean(input.desktop || input.mobile)
    : definition.input === 'mobile' ? Boolean(input.mobile)
    : definition.input === 'headers' ? Boolean(input.headers)
    : definition.input === 'accessibility' ? input.axe !== undefined || Boolean(input.accessibilityEvidence || input.desktop || input.mobile)
    : definition.input === 'browser' ? Boolean(input.metrics) : true
}
