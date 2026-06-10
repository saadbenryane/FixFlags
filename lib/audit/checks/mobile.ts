import { PageSpeedResult } from '../pagespeed'
import { DeterministicFinding } from './index'

export function runMobileChecks(mobile: PageSpeedResult | null): DeterministicFinding[] {
  const findings: DeterministicFinding[] = []

  if (!mobile) return findings

  if (mobile.score !== null && mobile.score < 50) {
    findings.push({
      checkId: 'mobile-perf-critical',
      area: 'MOBILE',
      severity: 'CRITICAL',
      problem: `Mobile performance is critically low (${mobile.score}/100)`,
      evidence: `Google PageSpeed mobile score: ${mobile.score}/100`,
      fix: 'Mobile performance needs urgent attention. Prioritize: image optimization, code splitting, and reducing JavaScript execution time.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (mobile.score !== null && mobile.score < 75) {
    findings.push({
      checkId: 'mobile-perf-poor',
      area: 'MOBILE',
      severity: 'HIGH',
      problem: `Mobile performance needs improvement (${mobile.score}/100)`,
      evidence: `Google PageSpeed mobile score: ${mobile.score}/100`,
      fix: 'Improve mobile performance: compress images, lazy load below-the-fold content, and minimize render-blocking resources.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const tapTargets = mobile.opportunities.find((o) => o.id === 'tap-targets-too-small' || o.id === 'tap-targets')
  if (tapTargets) {
    findings.push({
      checkId: 'tap-targets-small',
      area: 'MOBILE',
      severity: 'HIGH',
      problem: 'Tap targets are too small for mobile users',
      evidence: 'Buttons or links found with tap area smaller than 48×48px',
      fix: 'Ensure all interactive elements have at least 48×48px touch area. Add padding to small buttons.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (mobile.lcp !== null && mobile.lcp / 1000 > 4) {
    findings.push({
      checkId: 'mobile-lcp-critical',
      area: 'MOBILE',
      severity: 'CRITICAL',
      problem: `Mobile LCP is critically slow (${(mobile.lcp / 1000).toFixed(1)}s)`,
      evidence: `Mobile Largest Contentful Paint: ${(mobile.lcp / 1000).toFixed(2)}s`,
      fix: 'Optimize the hero image for mobile: use responsive images, WebP format, and preload the LCP element.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
