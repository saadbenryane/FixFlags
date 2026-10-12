import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import { recordObservation, type CheckRecorder } from './assertion'

export function runVisualPolishChecks(metrics: CaptureMetrics | null, record?: CheckRecorder): DeterministicFlag[] {
  if (metrics == null) {
    recordObservation(record, 'font-family-count', 'Sampled typography', 'At most four font families occur in the sampled elements', 'Typography was not measured.', undefined, true)
    recordObservation(record, 'button-radius-range', 'Sampled button radii', 'Sampled non-pill button radii do not trigger the 6px variation rule', 'Button radii were not measured.', undefined, true)
    return []
  }

  const findings: DeterministicFlag[] = []

  recordObservation(record, 'font-family-count', 'Sampled typography', 'At most four font families occur in the sampled elements',
    `${metrics.uniqueFontFamilies} font families captured: ${metrics.fontFamilySample?.join(', ') ?? ''}.`,
    Number.isFinite(metrics.uniqueFontFamilies) && metrics.uniqueFontFamilies > 0 ? metrics.uniqueFontFamilies <= 4 : undefined, true)

  if (metrics.uniqueFontFamilies > 4) {
    const sample = metrics.fontFamilySample?.join(', ') ?? ''
    findings.push({
      checkId: 'visual-typography-sprawl',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: `Page uses ${metrics.uniqueFontFamilies} distinct font families`,
      evidence: `Detected font families: ${sample}.`,
      fix: '1. Consolidate to 2 font families (headings + body)\n2. Remove stray font imports from widgets and embeds\n3. Verify the font stack on every page of the app',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const radii = metrics.buttonBorderRadii?.filter((r) => r < 100).sort((a, b) => a - b) ?? []
  const allRadii = metrics.buttonBorderRadii ?? []
  const inconsistent = radii.length > 2 && radii[radii.length - 1] - radii[0] >= 6
  recordObservation(record, 'button-radius-range', 'Sampled button radii', 'Sampled non-pill button radii do not trigger the 6px variation rule',
    `${allRadii.length} distinct button radii captured: ${allRadii.join(', ')}px.`,
    allRadii.length && allRadii.every(radius => Number.isFinite(radius) && radius >= 0) ? !inconsistent : undefined, true)

  if (
    inconsistent
  ) {
    findings.push({
      checkId: 'visual-radius-inconsistent',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Button border radius varies by 6px or more across CTAs',
      evidence: `CTA buttons use ${allRadii.length} different border-radius values (${allRadii.join('px, ')}px).`,
      fix: '1. Pick one border-radius token for all CTAs (e.g. 8px or 9999px pill)\n2. Apply it to both primary and secondary CTAs\n3. Remove per-button radius overrides from CSS or inline styles',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
