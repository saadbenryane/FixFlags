import { FINDING_LABEL_COPY, FINDING_EXPLANATION_COPY } from '@/lib/marketing/copy/finding-labels'
import { FLAG_EXPLANATIONS, FLAG_EXPLANATION_FALLBACK } from '@/lib/marketing/copy/flag-explanations'

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
  'images-missing-alt': /^\d+ image\(s\) missing alt text$/i,
  'images-empty-alt': /images?.*empty alt/i,
  'form-inputs-no-label': /^\d+ form input\(s\) missing associated labels$/i,
  'buttons-no-text': /^\d+ button\(s\) missing accessible text$/i,
  'links-no-text': /^\d+ link\(s\) missing accessible text$/i,
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
}

/** Presentation only. Never rewrite the stored diagnosis or infer new measurements. */
export function customerFindingLabel(input: { checkId?: string | null; problem: string }): string {
  const check = (input.checkId ?? '').split('::page:')[0]
  const mobile = check.startsWith('mobile-') && !check.startsWith('mobile-perf-')
  const base = mobile ? check.slice(7) : check
  const label = FINDING_LABEL_COPY[base]
  if (!label || diagnosticHeadlines[base] && !diagnosticHeadlines[base].test(input.problem)) return input.problem
  const scoped = mobile && !base.startsWith('inp-') ? `${label} on phones` : label
  // Measurements and their page/origin scope belong to the recorded evidence.
  // A headline must not reconstruct either fact from English diagnosis text.
  return scoped
}

export function customerFindingExplanation(input: { checkId?: string | null; whyItMatters: string }): string {
  const check = (input.checkId ?? '').split('::page:')[0]
  const base = check.replace(/^mobile-/, '')
  if (input.whyItMatters && input.whyItMatters !== FLAG_EXPLANATIONS[check] &&
      input.whyItMatters !== FLAG_EXPLANATIONS[base] && input.whyItMatters !== FLAG_EXPLANATION_FALLBACK) return input.whyItMatters
  const key = /^(lcp|cls|inp)-/.exec(base)?.[1] ?? (/^perf-/.test(base) ? 'speed' : base)
  return FINDING_EXPLANATION_COPY[key] ?? input.whyItMatters
}
