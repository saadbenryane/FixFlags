import type { SlowReplayResult } from '../flow/slow-replay-probe'
import { DeterministicFlag } from './index'
import { registerCheck } from './registry'

registerCheck({
  id: 'slow-3g-blank-screen',
  rubric: 'EXPERIENCE',
  impactTag: 'CONVERSION',
  severity: 'CRITICAL',
  tags: ['requiresBrowser', 'slow-replay'],
  requiresBrowser: true,
  evaluate: () => null,
})

registerCheck({
  id: 'slow-3g-cta-delayed',
  rubric: 'EXPERIENCE',
  impactTag: 'CONVERSION',
  severity: 'IMPORTANT',
  tags: ['requiresBrowser', 'slow-replay'],
  requiresBrowser: true,
  evaluate: () => null,
})

export function runSlowReplayChecks(result: SlowReplayResult | null): DeterministicFlag[] {
  if (!result) return []

  const findings: DeterministicFlag[] = []

  if (result.timeToFirstTextMs > 5_000) {
    const textNeverAppeared = result.timeToFirstTextMs >= 30_000
    findings.push({
      checkId: 'slow-3g-blank-screen',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'CRITICAL',
      problem: 'Page stays blank too long on slow 3G',
      evidence: textNeverAppeared
        ? 'On simulated 3G, meaningful text was not detected within 30 seconds (threshold 5000ms).'
        : `On simulated 3G, meaningful text appeared after ${result.timeToFirstTextMs}ms (threshold 5000ms).`,
      fix: '1. Reduce JavaScript bundle size with code splitting\n2. Defer non-critical scripts using async or defer\n3. Show static hero HTML before JavaScript hydrates',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (result.timeToCtaMs > 8_000) {
    const ctaNeverAppeared = result.timeToCtaMs >= 30_000
    findings.push({
      checkId: 'slow-3g-cta-delayed',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Primary CTA is not visible within 8 seconds on slow 3G',
      evidence: ctaNeverAppeared
        ? 'On simulated 3G, the primary CTA was not detected within 30 seconds.'
        : `On simulated 3G, the primary CTA became visible after ${result.timeToCtaMs}ms.`,
      fix: '1. Render the primary CTA in the initial server HTML (not JS-dependent)\n2. Inline critical CSS for the hero section including the CTA\n3. Test on simulated 3G to confirm CTA appears before full JS load',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
