import { PageSpeedResult } from '../pagespeed'
import type { DeterministicFlag } from '../flag-types'

export function runMobileChecks(mobile: PageSpeedResult | null): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (!mobile) return findings

  if (mobile.score !== null && mobile.score < 50) {
    findings.push({
      checkId: 'mobile-perf-critical',
      rubric: 'EXPERIENCE',
      severity: 'CRITICAL',
      problem: `Mobile performance is critically low (${mobile.score}/100)`,
      evidence: `Google PageSpeed mobile score: ${mobile.score}/100`,
      fix: '1. Optimize images for mobile (WebP, responsive sizes)\n2. Enable code splitting to reduce initial JavaScript\n3. Reduce JavaScript execution time with lazy loading and defer',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (mobile.score !== null && mobile.score < 75) {
    findings.push({
      checkId: 'mobile-perf-poor',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: `Mobile performance needs improvement (${mobile.score}/100)`,
      evidence: `Google PageSpeed mobile score: ${mobile.score}/100`,
      fix: '1. Compress images and serve responsive sizes for mobile\n2. Lazy load below-the-fold content (IntersectionObserver)\n3. Minimize render-blocking resources with defer and async',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const tapTargets = mobile.opportunities.find(
    (o) =>
      o.id === 'tap-targets-too-small' ||
      o.id === 'tap-targets' ||
      o.id === 'target-size'
  )
  if (tapTargets) {
    const itemCount = tapTargets.itemsCount ? ` (${tapTargets.itemsCount} element${tapTargets.itemsCount > 1 ? 's' : ''})` : ''
    findings.push({
      checkId: 'tap-targets-small',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: 'Tap targets are too small for mobile users',
      evidence: `Lighthouse: ${tapTargets.title}${itemCount}. Interactive elements need to be at least 48x48px for comfortable tapping.`,
      fix: '1. Identify interactive elements smaller than 48x48px\n2. Add padding or increase size to meet the 48x48px minimum\n3. Use min-height and min-width instead of fixed sizes for flexibility',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (mobile.lcp !== null && mobile.lcp / 1000 > 4) {
    findings.push({
      checkId: 'mobile-lcp-critical',
      rubric: 'EXPERIENCE',
      severity: 'CRITICAL',
      problem: `Mobile LCP is critically slow (${(mobile.lcp / 1000).toFixed(1)}s)`,
      evidence: `Mobile Largest Contentful Paint: ${(mobile.lcp / 1000).toFixed(2)}s`,
      fix: '1. Serve different image sizes for mobile viewports (srcset + sizes)\n2. Convert the hero image to WebP or AVIF format\n3. Preload the hero image with <link rel="preload"> as image',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
