import { PageMetadata } from '../metadata'
import { PageSpeedResult } from '../pagespeed'
import type { DeterministicFlag } from '../flag-types'

export interface AxeViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  help: string
  helpUrl: string
  nodes: Array<{
    html: string
    target: string[]
    failureSummary: string
  }>
}

/** Map axe-core impact levels to FixFlags severity. */
function axeImpactToSeverity(impact: AxeViolation['impact']): string {
  switch (impact) {
    case 'critical':
      return 'CRITICAL'
    case 'serious':
      return 'IMPORTANT'
    case 'moderate':
    case 'minor':
      return 'POLISH'
  }
}

/** Map axe rule IDs to FixFlags check IDs. */
function axeRuleToCheckId(axeId: string): string {
  const mapping: Record<string, string> = {
    'color-contrast': 'color-contrast-poor',
    'image-alt': 'images-missing-alt',
    'input-image-alt': 'images-missing-alt',
    'label': 'form-inputs-no-label',
    'select-name': 'form-inputs-no-label',
    'button-name': 'buttons-no-text',
    'link-name': 'links-no-text',
    'frame-title': 'iframe-no-title',
    'frame-title-unique': 'iframe-no-title',
    'tabindex': 'tabindex-positive',
    'bypass': 'skip-link-missing',
    'region': 'skip-link-missing',
    'focus-order-semantics': 'focus-visible-missing',
    'aria-required-children': 'axe-aria-required-children',
    'aria-required-parent': 'axe-aria-required-parent',
    'duplicate-id-active': 'axe-duplicate-id-active',
    'duplicate-id-aria': 'axe-duplicate-id-aria',
    'heading-order': 'heading-hierarchy-missing',
    'landmark-banner-is-top-level': 'axe-landmark-banner',
    'landmark-contentinfo-is-top-level': 'axe-landmark-contentinfo',
    'landmark-main-is-top-level': 'axe-landmark-main',
    'landmark-no-duplicate-banner': 'axe-landmark-duplicate',
    'landmark-one-main': 'axe-landmark-one-main',
    'page-has-heading-one': 'axe-missing-h1',
    'heading-order': 'heading-hierarchy-missing',
    'list': 'axe-list-structure',
    'listitem': 'axe-list-structure',
    'meta-viewport': 'axe-meta-viewport',
  }
  return mapping[axeId] ?? `axe-${axeId}`
}

/** Build a human-readable fix suggestion from an axe violation. */
function buildAxeFix(violation: AxeViolation): string {
  const nodeCount = violation.nodes.length
  const example = violation.nodes[0]
  const selector = example?.target?.join(' > ') ?? 'unknown element'

  const lines = [
    violation.help,
    '',
    `Affected elements: ${nodeCount}`,
    `Example: ${selector}`,
    '',
    'Failure details:',
  ]

  for (const node of violation.nodes.slice(0, 3)) {
    lines.push(`  - ${node.failureSummary}`)
  }

  if (nodeCount > 3) {
    lines.push(`  ... and ${nodeCount - 3} more`)
  }

  return lines.join('\n')
}

/**
 * Run axe-core accessibility checks and map results to FixFlags flags.
 * Falls back to PageSpeed-based checks for rules axe-core doesn't cover.
 */
export function runAccessibilityChecks(
  meta: PageMetadata,
  pagespeed: PageSpeedResult | null,
  axeViolations?: AxeViolation[]
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  // --- axe-core results (primary signal) ---
  if (axeViolations && axeViolations.length > 0) {
    const processedCheckIds = new Set<string>()

    for (const violation of axeViolations) {
      const checkId = axeRuleToCheckId(violation.id)

      // Deduplicate by resolved check ID (e.g., multiple image-alt violations -> one flag)
      if (processedCheckIds.has(checkId)) continue
      processedCheckIds.add(checkId)

      const nodeCount = violation.nodes.length
      const evidence = violation.nodes
        .slice(0, 3)
        .map((n) => n.html.replace(/\s+/g, ' ').slice(0, 200))
        .join('\n')

      findings.push({
        checkId,
        rubric: 'EXPERIENCE',
        impactTag: 'ACCESSIBILITY',
        severity: axeImpactToSeverity(violation.impact),
        problem: `${violation.help} (${nodeCount} element${nodeCount > 1 ? 's' : ''})`,
        evidence: evidence || violation.description,
        fix: buildAxeFix(violation),
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  // --- PageSpeed-based fallback checks ---
  // These cover areas axe-core doesn't analyze (focus-visible, keyboard traps from Lighthouse audits)

  if (pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'focus-traps')) {
    const audit = pagespeed.failedAccessibilityAudits.find((a) => a.id === 'focus-traps')
    findings.push({
      checkId: 'keyboard-nav-trap',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: 'Keyboard focus may be trapped in a modal or overlay',
      evidence: `Lighthouse: ${audit?.title ?? 'focus-traps audit failed'}`,
      fix: '1. Ensure the modal traps keyboard focus while open\n2. Close the modal on Escape key press\n3. Restore focus to the trigger element when the modal closes',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'focus-visible')) {
    const audit = pagespeed.failedAccessibilityAudits.find((a) => a.id === 'focus-visible')
    findings.push({
      checkId: 'focus-visible-missing',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: 'Focus indicators are missing or insufficient',
      evidence: `Lighthouse: ${audit?.title ?? 'focus-visible audit failed'}`,
      fix: '1. Add visible :focus-visible styles to all interactive elements\n2. Use a high-contrast focus ring (2px solid offset)\n3. Never remove outline without replacing it with a visible alternative',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  // --- DOM-based checks that axe-core handles differently or not at all ---

  // Skip link: axe-core checks `bypass` and `region`, but we also check
  // the nav-landmark + skip-link combination for a more specific signal.
  const bypassFailed =
    pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'bypass') ?? false
  const hasAxeBypass = axeViolations?.some(
    (v) => v.id === 'bypass' || v.id === 'region'
  )
  if (!hasAxeBypass && ((meta.navLandmarkCount > 0 && !meta.hasSkipLink) || bypassFailed)) {
    findings.push({
      checkId: 'skip-link-missing',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: 'No skip-to-content link for keyboard users',
      evidence: bypassFailed
        ? `Lighthouse bypass audit failed; nav landmarks: ${meta.navLandmarkCount}`
        : `Page has ${meta.navLandmarkCount} navigation landmark(s) but no skip link`,
      fix: '1. Add a skip link as the first focusable element in the body\n2. Use: <a href="#main-content" class="skip-link">Skip to content</a>\n3. Style it to become visible on focus (not hidden with display:none)',
      confidence: bypassFailed ? 1.0 : 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
