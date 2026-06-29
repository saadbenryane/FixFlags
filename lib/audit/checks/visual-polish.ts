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
      evidence: `Detected font families: ${sample}. Limit to 2-3 families for visual cohesion.`,
      fix: 'Consolidate to 2 font families: one for headings (e.g. Inter or Poppins) and one for body text (e.g. system-ui or Inter).',
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
    (allRadii[allRadii.length - 1] - allRadii[0]) >= 6
  ) {
    findings.push({
      checkId: 'visual-radius-inconsistent',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Button border radius varies by 6px or more across CTAs',
      evidence: `CTA buttons use ${allRadii.length} different border-radius values (${allRadii.join('px, ')}px).`,
      fix: 'Pick one border-radius token for all CTAs (e.g. 8px for a modern look or 9999px for pill shape).',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}