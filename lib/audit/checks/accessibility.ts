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

/**
 * Drop nodes whose axe target path points into an iframe/frame. Cross-origin
 * player DOM (YouTube, Calendly, Stripe) is not the site's code; same-origin
 * frames are still analyzed by axe when present in the top-level results.
 */
export function isIframeAxeTarget(target: string[] | undefined): boolean {
  if (!target || target.length === 0) return false
  return target.some((part) => {
    const value = String(part).toLowerCase()
    return (
      value.includes('iframe') ||
      value.includes('frame[') ||
      value.startsWith('frame ') ||
      /\bframe\b/.test(value)
    )
  })
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
    'heading-order': 'heading-order-skipped',
    'landmark-banner-is-top-level': 'axe-landmark-banner',
    'landmark-contentinfo-is-top-level': 'axe-landmark-contentinfo',
    'landmark-main-is-top-level': 'axe-landmark-main',
    'landmark-no-duplicate-banner': 'axe-landmark-duplicate',
    'landmark-one-main': 'axe-landmark-one-main',
    'page-has-heading-one': 'axe-missing-h1',
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
  const axeUnavailable = axeViolations == null
  const scopedAxeViolations = axeUnavailable
    ? []
    : filterOutIframeAxeViolations(axeViolations)
  if (!axeUnavailable && scopedAxeViolations.length > 0) {
    const processedCheckIds = new Set<string>()

    for (const violation of scopedAxeViolations) {
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
  } else if (axeUnavailable) {
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
        fix: '1. Add <label for="id"> to every visible input\n2. Or add aria-label to icon-only inputs\n3. Placeholder text is not a label replacement',
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
        fix: '1. Add visible text to icon-only buttons\n2. Or add aria-label describing the action\n3. Ensure button text is descriptive (not "click here")',
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
        fix: '1. Add visible text or aria-label to every link\n2. Icon links must have aria-label describing the destination\n3. Avoid empty <a> tags without any accessible name',
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
