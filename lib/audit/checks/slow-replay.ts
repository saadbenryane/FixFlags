import type { SlowReplayResult } from '../flow/slow-replay-probe'
import { DeterministicFlag } from './index'

export function runSlowReplayChecks(result: SlowReplayResult | null): DeterministicFlag[] {
  if (!result) return []

  const findings: DeterministicFlag[] = []

  if (result.timeToFirstTextMs > 5_000) {
    findings.push({
      checkId: 'slow-3g-blank-screen',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'CRITICAL',
      problem: 'Page stays blank too long on slow 3G',
      evidence: `On simulated 3G, meaningful text appeared after ${result.timeToFirstTextMs}ms (threshold 5000ms).`,
      fix: 'Reduce JavaScript bundle size, defer non-critical scripts, and show static hero HTML before JS hydrates.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (result.timeToCtaMs > 8_000) {
    findings.push({
      checkId: 'slow-3g-cta-delayed',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Primary CTA is not visible within 8 seconds on slow 3G',
      evidence: `On simulated 3G, the primary CTA became visible after ${result.timeToCtaMs}ms.`,
      fix: 'Render the primary CTA in the initial HTML or inline critical CSS so mobile visitors on slow networks can act immediately.',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
