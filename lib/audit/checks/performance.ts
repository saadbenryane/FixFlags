import { PageSpeedResult } from '../pagespeed'
import { DeterministicFinding } from './index'

export function runPerformanceChecks(
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null
): DeterministicFinding[] {
  void mobile
  const findings: DeterministicFinding[] = []
  const ps = desktop

  if (!ps) return findings

  if (ps.score !== null && ps.score < 50) {
    findings.push({
      checkId: 'perf-score-critical',
      area: 'PERFORMANCE',
      severity: 'CRITICAL',
      problem: `Desktop performance score is critically low (${ps.score}/100)`,
      evidence: `Google PageSpeed score: ${ps.score}/100 on desktop`,
      fix: 'Address the top opportunities listed in the performance audit: reduce unused JavaScript, optimize images, and eliminate render-blocking resources.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (ps.score !== null && ps.score < 75) {
    findings.push({
      checkId: 'perf-score-poor',
      area: 'PERFORMANCE',
      severity: 'HIGH',
      problem: `Desktop performance score is poor (${ps.score}/100)`,
      evidence: `Google PageSpeed score: ${ps.score}/100 on desktop`,
      fix: 'Improve performance by optimizing images, reducing JavaScript bundle size, and leveraging caching.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (ps.lcp !== null) {
    const lcpSeconds = ps.lcp / 1000
    if (lcpSeconds > 4) {
      findings.push({
        checkId: 'lcp-critical',
        area: 'PERFORMANCE',
        severity: 'CRITICAL',
        problem: `LCP is critically slow (${lcpSeconds.toFixed(1)}s, target < 2.5s)`,
        evidence: `Largest Contentful Paint: ${lcpSeconds.toFixed(2)}s`,
        fix: 'Preload the LCP element, optimize its image or font, and ensure the server responds quickly (< 600ms TTFB).',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else if (lcpSeconds > 2.5) {
      findings.push({
        checkId: 'lcp-poor',
        area: 'PERFORMANCE',
        severity: 'HIGH',
        problem: `LCP needs improvement (${lcpSeconds.toFixed(1)}s, target < 2.5s)`,
        evidence: `Largest Contentful Paint: ${lcpSeconds.toFixed(2)}s`,
        fix: 'Add fetchpriority="high" to your hero image, use a CDN, and compress the LCP element.',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  if (ps.cls !== null) {
    if (ps.cls > 0.25) {
      findings.push({
        checkId: 'cls-critical',
        area: 'PERFORMANCE',
        severity: 'CRITICAL',
        problem: `Layout shift is severe (CLS ${ps.cls}, target < 0.1)`,
        evidence: `Cumulative Layout Shift: ${ps.cls}`,
        fix: 'Set explicit width and height on all images and embeds. Avoid inserting content above existing content after page load.',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else if (ps.cls > 0.1) {
      findings.push({
        checkId: 'cls-poor',
        area: 'PERFORMANCE',
        severity: 'HIGH',
        problem: `Layout shift needs improvement (CLS ${ps.cls}, target < 0.1)`,
        evidence: `Cumulative Layout Shift: ${ps.cls}`,
        fix: 'Add size attributes to images, reserve space for ads/embeds, and use font-display: optional.',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  const renderBlocking = ps.opportunities.find((o) => o.id === 'render-blocking-resources')
  if (renderBlocking && renderBlocking.savings > 500) {
    findings.push({
      checkId: 'render-blocking',
      area: 'PERFORMANCE',
      severity: 'HIGH',
      problem: `Render-blocking resources delay page load (${Math.round(renderBlocking.savings / 1000 * 10) / 10}s savings)`,
      evidence: `Render-blocking resources identified: ${Math.round(renderBlocking.savings)}ms potential savings`,
      fix: 'Add defer or async to non-critical scripts. Move CSS inline for above-the-fold content or use <link rel="preload">.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const unusedJs = ps.opportunities.find((o) => o.id === 'unused-javascript')
  if (unusedJs && unusedJs.savings > 100_000) {
    findings.push({
      checkId: 'unused-js-large',
      area: 'PERFORMANCE',
      severity: 'HIGH',
      problem: `Large amount of unused JavaScript (${Math.round(unusedJs.savings / 1024)}KB savings)`,
      evidence: `Unused JS: ~${Math.round(unusedJs.savings / 1024)}KB could be removed`,
      fix: 'Use code splitting, lazy loading, and tree shaking. Remove unused npm packages.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const unusedCss = ps.opportunities.find((o) => o.id === 'unused-css-rules')
  if (unusedCss && unusedCss.savings > 50_000) {
    findings.push({
      checkId: 'unused-css-large',
      area: 'PERFORMANCE',
      severity: 'MEDIUM',
      problem: `Large amount of unused CSS (${Math.round(unusedCss.savings / 1024)}KB savings)`,
      evidence: `Unused CSS: ~${Math.round(unusedCss.savings / 1024)}KB could be removed`,
      fix: 'Use PurgeCSS or built-in Tailwind content purging to remove unused styles.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const unoptImages = ps.opportunities.find(
    (o) => o.id === 'uses-optimized-images' || o.id === 'uses-webp-images'
  )
  if (unoptImages && unoptImages.savings > 50_000) {
    findings.push({
      checkId: 'unoptimized-images',
      area: 'PERFORMANCE',
      severity: 'HIGH',
      problem: `Images are not optimized (${Math.round(unoptImages.savings / 1024)}KB savings)`,
      evidence: `Image optimization could save ~${Math.round(unoptImages.savings / 1024)}KB`,
      fix: 'Convert images to WebP/AVIF format, compress them, and use Next.js <Image> for automatic optimization.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
