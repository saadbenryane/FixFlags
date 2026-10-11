import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { detectPagePurpose } from '../page-purpose'
import { PAGE_CHECK_DEFINITIONS, type PageCheckDefinition } from './definitions'
import { runMetadataChecks, runOgImageUrlCheck } from './metadata-checks'
import { runPerformanceChecks } from './performance'
import { runAccessibilityChecks, type AxeViolation } from './accessibility'
import { runSeoChecks } from './seo'
import { runTrustChecks } from './trust'
import { runMobileChecks } from './mobile'
import { runContentChecks } from './content'
import { runSlopChecks } from './slop'
import { runLayoutChecks } from './layout'
import { runInteractionChecks } from './interaction'
import { runMeasurementChecks } from './measurement'
import { runSecurityBasicsChecks } from './security'
import { runSecurityHeaderChecks } from './security-headers'
import { runVisualPolishChecks } from './visual-polish'
import { runCtaFocusChecks } from './cta-focus'
import { runAuthCheckoutChecks } from './auth-checkout'
import { runMessagingClarityChecks } from './messaging-clarity'
import { runConversionFrictionChecks } from './conversion-friction'
import { runTrustPsychologyChecks } from './trust-psychology'
import { runVisualHierarchyChecks } from './visual-hierarchy'
import { runMobileUXQualityChecks } from './mobile-ux-quality'

export type PageCheckContext = {
  url: string; metadata: PageMetadata; desktop: PageSpeedResult | null; mobile: PageSpeedResult | null;
  consoleErrors: Array<{ type: string; text: string }>; metrics?: CaptureMetrics | null;
  headers?: Record<string, string> | null; axe?: AxeViolation[];
  purpose: ReturnType<typeof detectPagePurpose>; record(assertion: CheckAssertion): void;
}
type Evaluator = { id: string; evaluate(input: PageCheckContext): DeterministicFlag[] | Promise<DeterministicFlag[]> }
export function registerPageEvaluators(evaluators: Evaluator[], definitions = PAGE_CHECK_DEFINITIONS) {
  const registered = new Map<string, Evaluator & { definition: PageCheckDefinition }>()
  for (const evaluator of evaluators) {
    const definition = definitions[evaluator.id]
    if (registered.has(evaluator.id) || typeof evaluator.evaluate !== 'function' || !definition ||
      definition.evaluator !== evaluator.id || definition.resultSchema !== 'site-module-check-v1')
      throw new Error('Invalid page check registration: ' + evaluator.id)
    registered.set(evaluator.id, { ...evaluator, definition })
  }
  for (const id of Object.keys(definitions)) if (!registered.has(id)) throw new Error('Missing page check evaluator: ' + id)
  return registered
}

export const PAGE_CHECKS = registerPageEvaluators([
  { id: 'metadata', evaluate: c => runMetadataChecks(c.metadata, c.record) },
  { id: 'og-image', evaluate: c => runOgImageUrlCheck(c.url, c.metadata) },
  { id: 'accessibility', evaluate: c => runAccessibilityChecks(c.metadata, c.desktop ?? c.mobile, c.axe) },
  { id: 'seo', evaluate: c => runSeoChecks(c.url, c.metadata) },
  { id: 'trust', evaluate: c => runTrustChecks(c.url, c.metadata, c.consoleErrors) },
  { id: 'content', evaluate: c => runContentChecks(c.metadata, c.purpose) },
  { id: 'slop', evaluate: c => runSlopChecks(c.metadata) },
  { id: 'measurement', evaluate: c => runMeasurementChecks(c.metadata) },
  { id: 'auth-checkout', evaluate: c => runAuthCheckoutChecks(c.url, c.metadata) },
  { id: 'security', evaluate: c => runSecurityBasicsChecks(c.url, c.metadata) },
  { id: 'security-headers', evaluate: c => runSecurityHeaderChecks(c.url, c.headers ?? null) },
  { id: 'messaging-clarity', evaluate: c => runMessagingClarityChecks(c.metadata) },
  { id: 'conversion-friction', evaluate: c => runConversionFrictionChecks(c.metadata, c.purpose) },
  { id: 'trust-psychology', evaluate: c => runTrustPsychologyChecks(c.metadata, c.purpose, c.url) },
  { id: 'performance', evaluate: c => runPerformanceChecks(c.desktop, c.mobile) },
  { id: 'mobile', evaluate: c => runMobileChecks(c.mobile) },
  { id: 'mobile-ux-quality', evaluate: c => runMobileUXQualityChecks(c.metadata, c.metrics ?? null, c.purpose.purpose) },
  { id: 'layout', evaluate: c => runLayoutChecks(c.metrics ?? null, c.purpose.purpose) },
  { id: 'interaction', evaluate: c => runInteractionChecks(c.metrics ?? null) },
  { id: 'cta-focus', evaluate: c => runCtaFocusChecks(c.metrics ?? null) },
  { id: 'visual-polish', evaluate: c => runVisualPolishChecks(c.metrics ?? null) },
  { id: 'visual-hierarchy', evaluate: c => runVisualHierarchyChecks(c.metadata, c.metrics ?? null) },
])

export function pageCheckApplicable(definition: PageCheckDefinition, input: PageCheckContext) {
  return definition.input === 'performance' ? Boolean(input.desktop || input.mobile)
    : definition.input === 'mobile' ? Boolean(input.mobile)
    : definition.input === 'headers' ? Boolean(input.headers)
    : definition.input === 'accessibility' ? input.axe !== undefined || Boolean(input.desktop || input.mobile)
    : definition.input === 'browser' ? Boolean(input.metrics) : true
}
