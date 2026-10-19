import {
  METADATA_CHECK_IDS,
  formatVisualEvidence,
} from '@/lib/marketing/evidence-regions'
import { verificationRuleForCheckId } from '@/lib/audit/verification-rules'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { resolveFixPrompt } from '@/lib/audit/priority-flags'
import { FLAG_EXPLANATIONS, FLAG_EXPLANATION_FALLBACK } from '@/lib/marketing/copy/flag-explanations'
import { REPAIR_GUIDANCE_COPY } from '@/lib/marketing/copy/repair-guidance'

/** Checks fixed in source/head/config - not by staring at a screenshot region. */
const CODE_OR_HEAD_CHECKS = new Set<string>([
  ...METADATA_CHECK_IDS,
  'no-structured-data',
  'sitemap-missing',
  'robots-txt-missing',
  'no-https',
  'console-errors-critical',
  'console-errors-some',
  'external-links-unsafe',
  'broken-internal-links',
  'broken-page-anchors',
  'no-privacy-policy',
  'no-contact-info',
  'cookie-consent-absent',
  'render-blocking',
  'unused-js-large',
  'unused-css-large',
  'unoptimized-images',
  'perf-score-critical',
  'perf-score-poor',
  'lcp-critical',
  'lcp-poor',
  'cls-critical',
  'cls-poor',
  'inp-critical',
  'inp-poor',
  'mobile-perf-critical',
  'mobile-perf-poor',
  'mobile-lcp-critical',
  'flow-cta-404',
  'flow-cta-dead-end',
  'flow-cta-external-leave',
  'flow-pricing-nav-broken',
  'flow-mobile-menu-broken',
  'flow-form-no-validation',
  'flow-cta-blank-destination',
  'flow-form-slow-feedback',
  'flow-cta-destination-no-trust',
  'cta-dead-link',
])

/** Visible UI/copy checks where screenshot context helps humans. */
const VISUAL_EVIDENCE_CHECKS = new Set<string>([
  'h1-generic',
  'heading-hierarchy-missing',
  'heading-order-skipped',
  'h1-missing',
  'h1-multiple',
  'no-cta-detected',
  'cta-below-fold-mobile',
  'motion-ignores-reduced-preference',
  'visual-typography-sprawl',
  'visual-radius-inconsistent',
  'competing-ctas',
  'flow-no-cta-found',
  'flow-cta-unclickable',
  'tap-targets-small',
  'placeholder-copy-detected',
  'template-default-copy',
  'unreplaced-template-token',
  'social-proof-unverifiable',
  'images-missing-alt',
  'images-empty-alt',
  'form-inputs-no-label',
  'buttons-no-text',
  'links-no-text',
  'color-contrast-poor',
  'skip-link-missing',
  'keyboard-nav-trap',
  'focus-visible-missing',
  'loading-indicator-stuck',
  'loading-state-slow',
  'flow-cta-stuck-loading',
  'scroll-ghost-sections',
  'slow-3g-blank-screen',
  'slow-3g-cta-delayed',
])

const GENERIC_WHY_PATTERN =
  /affects the (message|experience|reach) quality of your page/i

export function isCodeOrHeadCheck(checkId: string): boolean {
  return CODE_OR_HEAD_CHECKS.has(checkId)
}

export function isGenericWhyItMatters(
  text: string | null | undefined
): boolean {
  if (!text?.trim()) return true
  return GENERIC_WHY_PATTERN.test(text)
}

export function whyItMattersForCheckId(checkId: string): string {
  return (
    FLAG_EXPLANATIONS[checkId] ?? FLAG_EXPLANATION_FALLBACK
  )
}

export function resolveWhyItMatters(flag: RankableFlag): string {
  if (flag.whyItMatters && !isGenericWhyItMatters(flag.whyItMatters)) {
    return flag.whyItMatters
  }
  if (flag.checkId) return whyItMattersForCheckId(flag.checkId)
  return flag.whyItMatters ?? flag.problem
}

export function resolveVerificationRule(flag: RankableFlag): string | null {
  if (flag.verificationRule?.trim()) return flag.verificationRule.trim()
  if (flag.checkId) return verificationRuleForCheckId(flag.checkId)
  return null
}

/** Human-readable evidence in the report UI - no screenshot fluff for head/code checks. */
export function formatDisplayEvidence(
  checkId: string | null | undefined,
  evidence: string
): string {
  const raw = evidence.trim()
  if (!checkId || isCodeOrHeadCheck(checkId)) return raw
  if (!VISUAL_EVIDENCE_CHECKS.has(checkId)) return raw
  if (
    /screenshot|viewport|visible|above the fold|below the fold|first screen|on mobile/i.test(
      raw
    )
  )
    return raw
  return formatVisualEvidence(checkId, raw)
}

export function buildExpertFixPrompt(
  flag: RankableFlag,
  extras?: { journeyName?: string | null }
): string {
  const guidance = resolveFixPrompt(flag)
  if (!guidance) return ''
  const evidence = (flag.evidence ?? flag.problem).trim()
  const fix = normalizeFixBody(guidance)
  if (!fix) return ''
  const verify = resolveVerificationRule(flag)

  const constraint =
    flag.rubric === 'MESSAGE'
      ? 'Do not restructure layout, change visual styles, or touch non-copy files.'
      : flag.rubric === 'EXPERIENCE'
        ? 'Do not rewrite marketing copy unless it directly affects usability. Do not change unrelated components.'
        : 'Do not change visible page content unless it affects social previews. Do not touch layout or copy.'

  const severity = REPAIR_GUIDANCE_COPY.recordedSeverity(flag.severity)

  const why = resolveWhyItMatters(flag)

  const lines = [
    `## Goal`,
    flag.problem.trim(),
    '',
    '## Constraint',
    `- ${constraint}`,
    `- ${severity}`,
    '',
    '## Context',
    `- Flag: ${flag.rubric} / ${flag.severity}`,
    `- URL: ${flag.pageUrl?.trim() || 'not recorded'}`,
    `- Journey: ${extras?.journeyName?.trim() || 'not inferred'}`,
    `- Evidence: ${evidence}`,
    '',
    '## Why it matters',
    `- ${why}`,
    '',
    '## Plan',
    fix,
  ]

  if (verify) {
    lines.push('', '## Verify', verify)
  }

  return lines.join('\n')
}

/** Concise report preview. The copied editor payload remains plan-shaped. */
export function buildFixPromptPreview(flag: RankableFlag): string {
  return normalizeFixBody(resolveFixPrompt(flag) ?? flag.problem)
}

/** Pull actionable steps out of legacy Goal/Observed/Expected essays. */
export function normalizeFixBody(raw: string): string {
  const trimmed = raw.trim()
  const expected = trimmed.match(
    /## Expected behavior\s*\n+([\s\S]*?)(?=\n## |\s*$)/i
  )
  if (expected?.[1]?.trim()) return expected[1].trim()

  if (/^## Goal\b/im.test(trimmed)) {
    const withoutVerify = trimmed
      .replace(/\n## How to verify\s*\n[\s\S]*$/i, '')
      .trim()
    const withoutHeaders = withoutVerify
      .replace(/^## Goal\s*\n+/im, '')
      .replace(/\n## Observed behavior\s*\n+/gi, '\n')
      .replace(/\n## Expected behavior\s*\n+/gi, '\n')
      .trim()
    if (withoutHeaders) return withoutHeaders
  }

  return trimmed
}
