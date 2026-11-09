import { severityRank } from '@/lib/utils'
import { PageMetadata } from '../metadata'
import { PageSpeedResult } from '../pagespeed'
import type { DeterministicFlag } from '../flag-types'
import { axeRuleToCheckId, axeTargetSelector, isIframeAxeTarget, type AxeTarget } from './accessibility-rules'

export { isIframeAxeTarget } from './accessibility-rules'

export interface AxeViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  help: string
  helpUrl: string
  nodes: Array<{
    html: string
    target: AxeTarget
    failureSummary: string
  }>
}

export function filterOutIframeAxeViolations(
  violations: AxeViolation[]
): AxeViolation[] {
  return violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter((node) => !isIframeAxeTarget(node.target)),
    }))
    .filter((violation) => violation.nodes.length > 0)
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

/**
 * Accessible-name fixes must not tell a builder to add visible text to icon
 * chrome. That rewrite is how a working header, close control, or social row
 * becomes a cluttered layout.
 */
export const ACCESSIBLE_NAME_BUTTON_FIX =
  '1. Keep the current icon or visual. Do not add visible text that changes the layout.\n2. Give the control an accessible name with aria-labelledby, aria-label or a visually hidden label that names the action.\n3. Confirm the name in a screen reader or the accessibility tree before shipping.'

export const ACCESSIBLE_NAME_LINK_FIX =
  '1. Keep the current icon or visual. Do not add visible text that changes the layout.\n2. Give the link an accessible name with aria-label, a child img alt, or a visually hidden label that names the destination.\n3. Confirm the name in a screen reader or the accessibility tree before shipping.'

export const ACCESSIBLE_NAME_INPUT_FIX =
  '1. Keep the current field visual. Do not replace the design with a placeholder-only label.\n2. Associate a visible label, or add aria-label for icon-only search and filter fields.\n3. Confirm the name in a screen reader or the accessibility tree before shipping.'

const ACCESSIBLE_NAME_FIX_BY_CHECK_ID: Record<string, string> = {
  'buttons-no-text': ACCESSIBLE_NAME_BUTTON_FIX,
  'links-no-text': ACCESSIBLE_NAME_LINK_FIX,
  'form-inputs-no-label': ACCESSIBLE_NAME_INPUT_FIX,
}

/** Build a human-readable fix suggestion from an axe violation. */
function buildAxeFix(violation: AxeViolation): string {
  const nodeCount = violation.nodes.length
  const example = violation.nodes[0]
  const selector = example ? axeTargetSelector(example.target) : 'unknown element'
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
  meta: PageMetadata | null,
  pagespeed: PageSpeedResult | null,
  axeViolations?: AxeViolation[],
  ownedDocuments = false
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  // --- axe-core results (primary signal) ---
  const axeUnavailable = axeViolations == null
  const scopedAxeViolations = axeUnavailable
    ? []
    : ownedDocuments ? axeViolations : filterOutIframeAxeViolations(axeViolations)
  if (!axeUnavailable && scopedAxeViolations.length > 0) {
    const groups = new Map<string, AxeViolation[]>()
    for (const violation of scopedAxeViolations) {
      const checkId = axeRuleToCheckId(violation.id)
      const group = groups.get(checkId)
      if (group) group.push(violation)
      else groups.set(checkId, [violation])
    }
    for (const [checkId, group] of groups) {
      // Keep one durable Flag while retaining the evidence and guidance for each rule.
      group.sort((a, b) => severityRank(axeImpactToSeverity(a.impact)) - severityRank(axeImpactToSeverity(b.impact)) || a.id.localeCompare(b.id))
      const primary = group[0]
      const grouped = group.length > 1
      const nodeCount = grouped
        ? new Set(group.flatMap(violation => violation.nodes.map(node => JSON.stringify(node.target)))).size
        : primary.nodes.length
      const evidence = group.map(violation => {
        const facts = [`Rule: ${violation.id}`]
        if (!grouped) facts.push(`Affected elements: ${nodeCount}`)
        return facts.concat(violation.nodes.slice(0, 3)
          .map(node => `${axeTargetSelector(node.target)}\n${node.html.replace(/\s+/g, ' ').slice(0, 200)}`)
        ).join('\n')
      }).join('\n\n')
      const elementCount = `${nodeCount} element${nodeCount === 1 ? '' : 's'}`
      const fixes = group.map(buildAxeFix)
      const safeNameFix = ACCESSIBLE_NAME_FIX_BY_CHECK_ID[checkId]
      if (safeNameFix) fixes.push(safeNameFix)

      findings.push({
        checkId,
        rubric: 'EXPERIENCE',
        impactTag: 'ACCESSIBILITY',
        severity: axeImpactToSeverity(primary.impact),
        problem: grouped ? `${primary.help} and related failures (${elementCount})` : `${primary.help} (${elementCount})`,
        evidence: grouped ? `Affected elements: ${nodeCount}\n\n${evidence}` : evidence,
        fix: fixes.join('\n\n'),
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  } else if (axeUnavailable && meta) {
    // --- Metadata-based fallback when axe-core results are unavailable ---
    // These checks provide baseline a11y coverage for offline/environments
    // where a live browser axe-core scan has not been performed.
    //
    // Accessible-name counts from static HTML are noisy on client-rendered
    // sites (hero composers, icon chrome, logo walls). Keep them visible as
    // POLISH. IMPORTANT/CRITICAL name findings require axe on a rendered page.
    // Missing alt is more reliable from HTML, so that fallback stays IMPORTANT.

    if (meta.imagesWithoutAlt && meta.imagesWithoutAlt > 0) {
      findings.push({
        checkId: 'images-missing-alt',
        rubric: 'EXPERIENCE',
        impactTag: 'ACCESSIBILITY',
        severity: 'IMPORTANT',
        problem: `${meta.imagesWithoutAlt} image(s) missing alt text`,
        evidence: `${meta.imagesWithoutAlt} images without alt attributes`,
        fix: '1. Add descriptive alt text to every informational image\n2. Use alt="" for decorative images\n3. Images with text must have alt matching the image text',
        confidence: 0.85,
        source: 'DETERMINISTIC',
      })
    }

    if (meta.inputsWithoutLabel && meta.inputsWithoutLabel > 0) {
      findings.push({
        checkId: 'form-inputs-no-label',
        rubric: 'EXPERIENCE',
        impactTag: 'ACCESSIBILITY',
        severity: 'POLISH',
        problem: `${meta.inputsWithoutLabel} form input(s) missing associated labels`,
        evidence: `${meta.inputsWithoutLabel} inputs without label or aria-label in the captured HTML. Confirm on the rendered page before treating this as a blocker.`,
        fix: ACCESSIBLE_NAME_INPUT_FIX,
        confidence: 0.7,
        source: 'DETERMINISTIC',
      })
    }

    if (meta.buttonsWithoutText && meta.buttonsWithoutText > 0) {
      findings.push({
        checkId: 'buttons-no-text',
        rubric: 'EXPERIENCE',
        impactTag: 'ACCESSIBILITY',
        severity: 'POLISH',
        problem: `${meta.buttonsWithoutText} button(s) missing accessible text`,
        evidence: `${meta.buttonsWithoutText} buttons without visible text or aria-label in the captured HTML. Confirm on the rendered page before treating this as a blocker.`,
        fix: ACCESSIBLE_NAME_BUTTON_FIX,
        confidence: 0.7,
        source: 'DETERMINISTIC',
      })
    }

    if (meta.linksWithoutText && meta.linksWithoutText > 0) {
      findings.push({
        checkId: 'links-no-text',
        rubric: 'EXPERIENCE',
        impactTag: 'ACCESSIBILITY',
        severity: 'POLISH',
        problem: `${meta.linksWithoutText} link(s) missing accessible text`,
        evidence: `${meta.linksWithoutText} links without visible text or aria-label in the captured HTML. Confirm on the rendered page before treating this as a blocker.`,
        fix: ACCESSIBLE_NAME_LINK_FIX,
        confidence: 0.7,
        source: 'DETERMINISTIC',
      })
    }

    if (meta.iframesWithoutTitle && meta.iframesWithoutTitle > 0) {
      findings.push({
        checkId: 'iframe-no-title',
        rubric: 'EXPERIENCE',
        impactTag: 'ACCESSIBILITY',
        severity: 'POLISH',
        problem: `${meta.iframesWithoutTitle} iframe(s) missing title attribute`,
        evidence: `${meta.iframesWithoutTitle} iframes without title`,
        fix: '1. Add a descriptive title attribute to every iframe\n2. Title should describe the embedded content\n3. Use title="YouTube video player" not title=""',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      })
    }

    if (meta.positiveTabindex && meta.positiveTabindex > 0) {
      findings.push({
        checkId: 'tabindex-positive',
        rubric: 'EXPERIENCE',
        impactTag: 'ACCESSIBILITY',
        severity: 'POLISH',
        problem: `${meta.positiveTabindex} element(s) with tabindex > 0`,
        evidence: `${meta.positiveTabindex} elements with tabindex > 0 detected`,
        fix: '1. Remove tabindex attributes greater than 0\n2. Use semantic HTML to establish natural tab order\n3. Only use tabindex="-1" or tabindex="0" for custom interactive elements',
        confidence: 0.9,
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
  if (!hasAxeBypass && ((meta && meta.navLandmarkCount > 0 && !meta.hasSkipLink) || bypassFailed)) {
    findings.push({
      checkId: 'skip-link-missing',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: 'No skip-to-content link for keyboard users',
      evidence: bypassFailed
        ? `Lighthouse bypass audit failed; nav landmarks: ${meta?.navLandmarkCount ?? 'unavailable'}`
        : `Page has ${meta?.navLandmarkCount ?? 'unavailable'} navigation landmark(s) but no skip link`,
      fix: '1. Add a skip link as the first focusable element in the body\n2. Use: <a href="#main-content" class="skip-link">Skip to content</a>\n3. Style it to become visible on focus (not hidden with display:none)',
      confidence: bypassFailed ? 1.0 : 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
