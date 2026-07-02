import type { CaptureMetrics } from '../capture-metrics'
import { DeterministicFlag } from './index'

const FONT_FAMILY_LIMIT = 4
const BUTTON_RADIUS_VARIANT_LIMIT = 2
const BUTTON_RADIUS_SPREAD_PX = 6

export function runDesignLanguageChecks(metrics: CaptureMetrics | null): DeterministicFlag[] {
  if (metrics == null) return []

  const findings: DeterministicFlag[] = []

  if (metrics.uniqueFontFamilies > FONT_FAMILY_LIMIT) {
    const sample = metrics.fontFamilySample.join(', ')
    findings.push({
      checkId: 'font-family-sprawl',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Too many font families on one page',
      evidence: `${metrics.uniqueFontFamilies} distinct font families detected (${sample}).`,
      fix: '1. Limit the page to 2–3 font families (headings, body, optional accent)\n2. Remove stray font imports from widgets and embeds\n3. Check that all pages in the app use the same font stack',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const radii = metrics.buttonBorderRadii.filter((r) => r < 100)
  const allRadii = metrics.buttonBorderRadii
  if (
    radii.length > BUTTON_RADIUS_VARIANT_LIMIT &&
    radii[radii.length - 1] - radii[0] >= BUTTON_RADIUS_SPREAD_PX
  ) {
    findings.push({
      checkId: 'button-radius-inconsistent',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Button corner radius varies across CTAs',
      evidence: `CTA buttons use ${allRadii.length} different border-radius values (${allRadii.join('px, ')}px).`,
      fix: '1. Pick one border-radius token for all CTAs (e.g. 8px or 9999px pill)\n2. Apply the same token to both primary and secondary CTAs\n3. Remove per-button radius overrides from CSS or inline styles',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
