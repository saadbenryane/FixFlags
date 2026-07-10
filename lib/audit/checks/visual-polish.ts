import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from './index'

export function runVisualPolishChecks(metrics: CaptureMetrics | null): DeterministicFlag[] {
  if (metrics == null) return []

  const findings: DeterministicFlag[] = []

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

  const radii = metrics.buttonBorderRadii?.filter((r) => r < 100) ?? []
  const allRadii = metrics.buttonBorderRadii ?? []

  if (
    radii.length > 2 &&
    radii.length > 0 &&
    allRadii.length > 0 &&
    (radii[radii.length - 1] - radii[0]) >= 6
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
