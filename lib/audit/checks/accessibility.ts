import { PageMetadata } from '../metadata'
import { DeterministicFinding } from './index'

export function runAccessibilityChecks(meta: PageMetadata): DeterministicFinding[] {
  const findings: DeterministicFinding[] = []

  if (meta.imagesWithoutAlt > 0) {
    findings.push({
      checkId: 'images-missing-alt',
      area: 'ACCESSIBILITY',
      severity: 'HIGH',
      problem: `${meta.imagesWithoutAlt} image${meta.imagesWithoutAlt > 1 ? 's' : ''} missing alt text`,
      evidence: `${meta.imagesWithoutAlt} <img> element${meta.imagesWithoutAlt > 1 ? 's' : ''} found without an alt attribute`,
      fix: 'Add descriptive alt text to all images. For decorative images, use alt="".',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.imagesWithEmptyAlt > 3) {
    findings.push({
      checkId: 'images-empty-alt',
      area: 'ACCESSIBILITY',
      severity: 'MEDIUM',
      problem: `${meta.imagesWithEmptyAlt} images have empty alt text`,
      evidence: `${meta.imagesWithEmptyAlt} images with alt=""`,
      fix: 'Review images with empty alt text. Only truly decorative images should have alt="". Informational images need descriptive alt text.',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.inputsWithoutLabel > 0) {
    findings.push({
      checkId: 'form-inputs-no-label',
      area: 'ACCESSIBILITY',
      severity: 'HIGH',
      problem: `${meta.inputsWithoutLabel} form input${meta.inputsWithoutLabel > 1 ? 's' : ''} without a label`,
      evidence: `${meta.inputsWithoutLabel} input element${meta.inputsWithoutLabel > 1 ? 's' : ''} found without associated <label>, aria-label, or aria-labelledby`,
      fix: 'Add a <label for="inputId"> or aria-label attribute to every form input.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.buttonsWithoutText > 0) {
    findings.push({
      checkId: 'buttons-no-text',
      area: 'ACCESSIBILITY',
      severity: 'HIGH',
      problem: `${meta.buttonsWithoutText} button${meta.buttonsWithoutText > 1 ? 's' : ''} without accessible text`,
      evidence: `${meta.buttonsWithoutText} button element${meta.buttonsWithoutText > 1 ? 's' : ''} found without text content or aria-label`,
      fix: 'Add aria-label or visible text to all buttons. Icon-only buttons must have aria-label describing their action.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.linksWithoutText > 0) {
    findings.push({
      checkId: 'links-no-text',
      area: 'ACCESSIBILITY',
      severity: 'HIGH',
      problem: `${meta.linksWithoutText} link${meta.linksWithoutText > 1 ? 's' : ''} without accessible text`,
      evidence: `${meta.linksWithoutText} <a> element${meta.linksWithoutText > 1 ? 's' : ''} found without text, aria-label, or title`,
      fix: 'Add aria-label or visible text to all links. "Click here" is not sufficient, describe the destination.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.iframesWithoutTitle > 0) {
    findings.push({
      checkId: 'iframe-no-title',
      area: 'ACCESSIBILITY',
      severity: 'MEDIUM',
      problem: `${meta.iframesWithoutTitle} iframe${meta.iframesWithoutTitle > 1 ? 's' : ''} without title attribute`,
      evidence: `${meta.iframesWithoutTitle} <iframe> element${meta.iframesWithoutTitle > 1 ? 's' : ''} without title attribute`,
      fix: 'Add a descriptive title attribute to all iframes: <iframe title="Embedded video: ...">',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.positiveTabindex > 0) {
    findings.push({
      checkId: 'tabindex-positive',
      area: 'ACCESSIBILITY',
      severity: 'MEDIUM',
      problem: `${meta.positiveTabindex} element${meta.positiveTabindex > 1 ? 's' : ''} with positive tabindex`,
      evidence: `Positive tabindex values found (tabindex="1" or higher)`,
      fix: 'Remove positive tabindex values. Use tabindex="0" to add elements to natural tab order, and tabindex="-1" to remove them.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
