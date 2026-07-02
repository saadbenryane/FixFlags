import { PageMetadata } from '../metadata'
import { PageSpeedResult } from '../pagespeed'
import { DeterministicFlag } from './index'

export function runAccessibilityChecks(
  meta: PageMetadata,
  pagespeed: PageSpeedResult | null
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (meta.imagesWithoutAlt > 0) {
    findings.push({
      checkId: 'images-missing-alt',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${meta.imagesWithoutAlt} image${meta.imagesWithoutAlt > 1 ? 's' : ''} missing alt text`,
      evidence: `${meta.imagesWithoutAlt} <img> element${meta.imagesWithoutAlt > 1 ? 's' : ''} found without an alt attribute`,
      fix: '1. Add descriptive alt text to every <img> element\n2. For decorative images, set alt="" (empty string)\n3. For informational images, describe what the image communicates',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.imagesWithEmptyAlt > 3) {
    findings.push({
      checkId: 'images-empty-alt',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: `${meta.imagesWithEmptyAlt} images have empty alt text`,
      evidence: `${meta.imagesWithEmptyAlt} images with alt=""`,
      fix: '1. Review each image with alt="" to confirm it is purely decorative\n2. Replace empty alt with descriptive text on informational images\n3. Treat logo, icon, and chart images as informational by default',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.inputsWithoutLabel > 0) {
    findings.push({
      checkId: 'form-inputs-no-label',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${meta.inputsWithoutLabel} form input${meta.inputsWithoutLabel > 1 ? 's' : ''} without a label`,
      evidence: `${meta.inputsWithoutLabel} input element${meta.inputsWithoutLabel > 1 ? 's' : ''} found without associated <label>, aria-label, or aria-labelledby`,
      fix: '1. Add a <label for="inputId"> to each form input\n2. If a visible label is not possible, add aria-label instead\n3. Test by clicking the label to confirm it focuses the input',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.buttonsWithoutText > 0) {
    findings.push({
      checkId: 'buttons-no-text',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${meta.buttonsWithoutText} button${meta.buttonsWithoutText > 1 ? 's' : ''} without accessible text`,
      evidence: `${meta.buttonsWithoutText} button element${meta.buttonsWithoutText > 1 ? 's' : ''} found without text content or aria-label`,
      fix: '1. Add visible text to buttons that only show icons\n2. If text would break the design, add aria-label describing the action\n3. Test with a screen reader to confirm the label is announced',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.linksWithoutText > 0) {
    findings.push({
      checkId: 'links-no-text',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${meta.linksWithoutText} link${meta.linksWithoutText > 1 ? 's' : ''} without accessible text`,
      evidence: `${meta.linksWithoutText} <a> element${meta.linksWithoutText > 1 ? 's' : ''} found without text, aria-label, or title`,
      fix: '1. Add aria-label or visible text to links that lack accessible names\n2. Describe the destination, not the action ("Pricing page" not "Click here")\n3. Test with a screen reader to confirm the link text is announced',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.iframesWithoutTitle > 0) {
    findings.push({
      checkId: 'iframe-no-title',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: `${meta.iframesWithoutTitle} iframe${meta.iframesWithoutTitle > 1 ? 's' : ''} without title attribute`,
      evidence: `${meta.iframesWithoutTitle} <iframe> element${meta.iframesWithoutTitle > 1 ? 's' : ''} without title attribute`,
      fix: '1. Add a title attribute to every <iframe> element\n2. Describe the embedded content: <iframe title="Product demo video">\n3. Remove empty or generic titles like "iframe" or "embed"',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.positiveTabindex > 0) {
    findings.push({
      checkId: 'tabindex-positive',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: `${meta.positiveTabindex} element${meta.positiveTabindex > 1 ? 's' : ''} with positive tabindex`,
      evidence: `Positive tabindex values found (tabindex="1" or higher)`,
      fix: '1. Remove positive tabindex values (tabindex="1" or higher)\n2. Use tabindex="0" to add elements to the natural tab order\n3. Use tabindex="-1" to make elements focusable via JavaScript only',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'color-contrast')) {
    const audit = pagespeed.failedAccessibilityAudits.find((a) => a.id === 'color-contrast')
    findings.push({
      checkId: 'color-contrast-poor',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: 'Text color contrast fails WCAG requirements',
      evidence: `Lighthouse: ${audit?.title ?? 'color-contrast audit failed'}`,
      fix: '1. Identify text elements with contrast below 4.5:1 (body) or 3:1 (large text)\n2. Darken the foreground or lighten the background to meet the threshold\n3. Run Chrome DevTools color contrast checker to confirm',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const bypassFailed =
    pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'bypass') ?? false
  if ((meta.navLandmarkCount > 0 && !meta.hasSkipLink) || bypassFailed) {
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

  return findings
}
