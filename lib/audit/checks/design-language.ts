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
      fix: 'Limit the page to 2–3 font families: one for headings, one for body, optional accent. Remove stray imports from widgets and embeds.',
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
      fix: 'Pick one button radius token (e.g. 8px or 9999px pill) and apply it to every primary and secondary CTA.',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
