import { PageSpeedResult } from '../pagespeed'
import { DeterministicFlag } from './index'

export function runPerformanceChecks(
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const ps = desktop

  if (!ps) {
    // Still evaluate INP from mobile when desktop PageSpeed is unavailable.
    if (mobile) findings.push(...runInpChecks(mobile))
    return findings
  }

  if (ps.score !== null && ps.score < 50) {
    findings.push({
      checkId: 'perf-score-critical',
      rubric: 'EXPERIENCE',
      severity: 'CRITICAL',
      problem: `Desktop performance score is critically low (${ps.score}/100)`,
      evidence: `Google PageSpeed score: ${ps.score}/100 on desktop`,
      fix: '1. Open the PageSpeed report and review the top opportunities\n2. Reduce unused JavaScript with code splitting and tree shaking\n3. Optimize images to WebP/AVIF and eliminate render-blocking resources',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (ps.score !== null && ps.score < 75) {
    findings.push({
      checkId: 'perf-score-poor',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: `Desktop performance score is poor (${ps.score}/100)`,
      evidence: `Google PageSpeed score: ${ps.score}/100 on desktop`,
      fix: '1. Optimize images to modern formats (WebP/AVIF) and compress them\n2. Reduce JavaScript bundle size with code splitting\n3. Leverage browser caching and CDN edge caching',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (ps.lcp !== null) {
    const lcpSeconds = ps.lcp / 1000
    if (lcpSeconds > 4) {
      findings.push({
        checkId: 'lcp-critical',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: `LCP is critically slow (${lcpSeconds.toFixed(1)}s, target < 2.5s)`,
        evidence: `Largest Contentful Paint: ${lcpSeconds.toFixed(2)}s`,
        fix: '1. Identify the LCP element (hero image, heading, or large text block)\n2. Add preload for the LCP image or font\n3. Ensure the server responds within 600ms TTFB (use CDN, enable caching)',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else if (lcpSeconds > 2.5) {
      findings.push({
        checkId: 'lcp-poor',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        problem: `LCP needs improvement (${lcpSeconds.toFixed(1)}s, target < 2.5s)`,
        evidence: `Largest Contentful Paint: ${lcpSeconds.toFixed(2)}s`,
        fix: '1. Add fetchpriority="high" to the hero image\n2. Serve the image from a CDN with compression\n3. Convert to WebP or AVIF format for smaller file size',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  if (ps.cls !== null) {
    if (ps.cls > 0.25) {
      findings.push({
        checkId: 'cls-critical',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: `Layout shift is severe (CLS ${ps.cls}, target < 0.1)`,
        evidence: `Cumulative Layout Shift: ${ps.cls}`,
        fix: '1. Set explicit width and height attributes on all images\n2. Set explicit dimensions on embeds, ads, and iframes\n3. Avoid inserting content above existing content after the page loads',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else if (ps.cls > 0.1) {
      findings.push({
        checkId: 'cls-poor',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        problem: `Layout shift needs improvement (CLS ${ps.cls}, target < 0.1)`,
        evidence: `Cumulative Layout Shift: ${ps.cls}`,
        fix: '1. Add width and height attributes to all images\n2. Reserve space for ads and embeds with CSS aspect-ratio or min-height\n3. Use font-display: optional or swap for web fonts',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  const renderBlocking = ps.opportunities.find((o) => o.id === 'render-blocking-resources')
  if (renderBlocking && renderBlocking.savings > 500) {
    findings.push({
      checkId: 'render-blocking',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: `Render-blocking resources delay page load (${Math.round(renderBlocking.savings / 1000 * 10) / 10}s savings)`,
      evidence: `Render-blocking resources identified: ${Math.round(renderBlocking.savings)}ms potential savings`,
      fix: '1. Add defer to non-critical script tags\n2. Move critical CSS inline for above-the-fold content\n3. Use <link rel="preload"> for fonts and hero images',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const unusedJs = ps.opportunities.find((o) => o.id === 'unused-javascript')
  if (unusedJs && unusedJs.savings > 100_000) {
    findings.push({
      checkId: 'unused-js-large',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: `Large amount of unused JavaScript (${Math.round(unusedJs.savings / 1024)}KB savings)`,
      evidence: `Unused JS: ~${Math.round(unusedJs.savings / 1024)}KB could be removed`,
      fix: '1. Enable code splitting at the route level (dynamic imports)\n2. Add lazy loading for below-the-fold components\n3. Run tree shaking and remove unused npm packages',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const unusedCss = ps.opportunities.find((o) => o.id === 'unused-css-rules')
  if (unusedCss && unusedCss.savings > 50_000) {
    findings.push({
      checkId: 'unused-css-large',
      rubric: 'EXPERIENCE',
      severity: 'POLISH',
      problem: `Large amount of unused CSS (${Math.round(unusedCss.savings / 1024)}KB savings)`,
      evidence: `Unused CSS: ~${Math.round(unusedCss.savings / 1024)}KB could be removed`,
      fix: '1. Configure content paths for PurgeCSS or Tailwind content purging\n2. Run the purge step in your build process\n3. Verify no styles are missing after purging',
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
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: `Images are not optimized (${Math.round(unoptImages.savings / 1024)}KB savings)`,
      evidence: `Image optimization could save ~${Math.round(unoptImages.savings / 1024)}KB`,
      fix: '1. Convert images to WebP or AVIF format\n2. Compress to reduce file size without visible quality loss\n3. Use Next.js <Image> component or a similar optimizer for automatic optimization',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (mobile) findings.push(...runInpChecks(mobile))

  return findings
}

function runInpChecks(mobile: PageSpeedResult): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  if (mobile.inp === null) return findings

  if (mobile.inp > 500) {
    findings.push({
      checkId: 'inp-critical',
      rubric: 'EXPERIENCE',
      severity: 'CRITICAL',
      problem: `Interaction to Next Paint is critically slow (${mobile.inp}ms, target <= 200ms)`,
      evidence: `INP: ${mobile.inp}ms on mobile`,
      fix: '1. Defer non-critical JavaScript to reduce main-thread work\n2. Split long tasks (over 50ms) with setTimeout or scheduler.yield\n3. Optimize event handlers to avoid heavy DOM operations',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (mobile.inp > 200) {
    findings.push({
      checkId: 'inp-poor',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: `Interaction to Next Paint needs improvement (${mobile.inp}ms, target <= 200ms)`,
      evidence: `INP: ${mobile.inp}ms on mobile`,
      fix: '1. Open Chrome DevTools Performance panel and record an interaction\n2. Identify long tasks and JavaScript execution during the interaction\n3. Reduce or defer non-essential work to keep INP under 200ms',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
