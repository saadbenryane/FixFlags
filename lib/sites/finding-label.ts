import { FINDING_LABEL_COPY, FINDING_EXPLANATION_COPY } from '@/lib/marketing/copy/finding-labels'
import { FLAG_EXPLANATIONS, FLAG_EXPLANATION_FALLBACK } from '@/lib/marketing/copy/flag-explanations'
import { isRetiredFlagExplanation } from './retired-flag-explanations'

/** Accessibility engine output: its rule summary and the affected element count. */
const AXE_HEADLINE = /\(\d+ elements?\)$/

/** Checks whose stored diagnosis can carry custom wording. The plain title
 * replaces only the generated headlines below; anything else stays exact. */
const diagnosticHeadlines: Readonly<Record<string, RegExp>> = {
  'unoptimized-images': /images are not optimized/i,
  'render-blocking': /render.blocking/i,
  'unused-js-large': /unused JavaScript/i,
  'unused-css-large': /unused CSS/i,
  'perf-score-critical': /performance score/i, 'perf-score-poor': /performance score/i,
  'mobile-perf-critical': /mobile performance/i, 'mobile-perf-poor': /mobile performance/i,
  'lcp-critical': /\bLCP\b|Largest Contentful Paint/i, 'lcp-poor': /\bLCP\b|Largest Contentful Paint/i,
  'cls-critical': /layout shift|\bCLS\b/i, 'cls-poor': /layout shift|\bCLS\b/i,
  'inp-critical': /Interaction to Next Paint|\bINP\b/i, 'inp-poor': /Interaction to Next Paint|\bINP\b/i,
  'images-missing-alt': /^\d+ image\(s\) missing alt text$|\(\d+ elements?\)$/i,
  'images-empty-alt': /images?.*empty alt/i,
  'form-inputs-no-label': /^\d+ form input\(s\) missing associated labels$|\(\d+ elements?\)$/i,
  'buttons-no-text': /^\d+ button\(s\) missing accessible text$|\(\d+ elements?\)$/i,
  'links-no-text': /^\d+ link\(s\) missing accessible text$|\(\d+ elements?\)$/i,
  'axe-document-title': /^Documents must have <title> element(?: \(\d+ elements?\))?$/i,
  'flow-destination-no-cta': /^Destination page has no next-step CTA for the user$/i,
  'flow-cta-destination-no-trust': /^CTA destination page lacks trust signals$/i,
  'title-missing': /^Page title is missing$/i,
  'title-too-long': /^Page title (?:may be verbose|is too long)/i,
  'description-missing': /^Meta description is missing$/i,
  'description-too-long': /^Meta description (?:may be verbose|is too long)/i,
  'h1-missing': /^No H1 heading found$/i, 'h1-multiple': /^Multiple different H1 headings found/i,
  'console-errors-critical': /JavaScript console errors? detected/i,
  'console-errors-some': /JavaScript console errors? detected/i,
  'page-http-error': /^This page returns (?:HTTP \d{3}|a missing-page response)$/i,
}

/** One check, several recorded conditions: each keeps its own plain title. */
const conditionTitles: Readonly<Record<string, ReadonlyArray<readonly [RegExp, string]>>> = {
  'flow-form-no-validation': [[/submit control/i, 'flow-form-no-submit'], [/validation feedback/i, 'flow-form-no-validation']],
  'flow-form-slow-feedback': [[/submit control/i, 'flow-form-no-submit'], [/too slow/i, 'flow-form-slow-feedback']],
  'flow-cta-unclickable': [[/blocked at its center/i, 'flow-cta-blocked'], [/could not be clicked/i, 'flow-cta-unclickable']],
  'journey-funnel-dead-end': [[/substantive content/i, 'journey-funnel-empty-page'], [/continuation/i, 'journey-funnel-dead-end']],
  'journey-funnel-accessibility-barrier': [[/unnamed control/i, 'journey-funnel-unnamed-control'], [/heading/i, 'heading-order-skipped']],
}

/** Every visitor path shares one title per condition, whatever path it ran on. */
const JOURNEY_CONDITION = /^journey-(?!funnel-)[a-z-]+?-(unclear-value-prop|hidden-cta|destination-no-headline|destination-no-next-action|dead-end)$/

function labelKey(check: string, problem: string): string | null {
  const conditions = conditionTitles[check]
  if (conditions) return conditions.find(([pattern]) => pattern.test(problem))?.[1] ?? null
  const journey = JOURNEY_CONDITION.exec(check)
  if (journey && !FINDING_LABEL_COPY[check]) return `journey-${journey[1]}`
  if (check.startsWith('axe-') && !diagnosticHeadlines[check] && !AXE_HEADLINE.test(problem)) return null
  return check
}

/** Presentation only. Never rewrite the stored diagnosis or infer new measurements. */
export function customerFindingLabel(input: { checkId?: string | null; problem: string }): string {
  const check = (input.checkId ?? '').split('::page:')[0]
  const mobile = check.startsWith('mobile-') && !check.startsWith('mobile-perf-')
  const base = mobile ? check.slice(7) : check
  const key = labelKey(base, input.problem)
  const label = key ? FINDING_LABEL_COPY[key] : undefined
  if (!label || diagnosticHeadlines[base] && !diagnosticHeadlines[base].test(input.problem)) return input.problem
  const scoped = mobile && !base.startsWith('inp-') ? `${label} on phones` : label
  // Measurements and their page/origin scope belong to the recorded evidence.
  // A headline must not reconstruct either fact from English diagnosis text.
  return scoped
}

/** A stored explanation written from a check's template follows the current
 * template; an explanation written for one observation stays exact. */
export function customerFindingExplanation(input: { checkId?: string | null; whyItMatters: string }): string {
  const check = (input.checkId ?? '').split('::page:')[0]
  const base = check.replace(/^mobile-/, '')
  const retired = isRetiredFlagExplanation(input.whyItMatters)
  const templated = !input.whyItMatters || retired || input.whyItMatters === FLAG_EXPLANATIONS[check] ||
    input.whyItMatters === FLAG_EXPLANATIONS[base] || input.whyItMatters === FLAG_EXPLANATION_FALLBACK
  if (!templated) return input.whyItMatters
  const key = /^(lcp|cls|inp)-/.exec(base)?.[1] ?? (/^perf-/.test(base) ? 'speed' : base)
  const current = FINDING_EXPLANATION_COPY[key] ?? FLAG_EXPLANATIONS[check] ?? FLAG_EXPLANATIONS[base]
  return current ?? (retired || !input.whyItMatters ? FLAG_EXPLANATION_FALLBACK : input.whyItMatters)
}
