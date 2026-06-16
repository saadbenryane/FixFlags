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
      fix: 'Address the top opportunities listed in the performance audit: reduce unused JavaScript, optimize images, and eliminate render-blocking resources.',
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
        rubric: 'EXPERIENCE',
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
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
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
        rubric: 'EXPERIENCE',
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
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
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
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
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
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
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
      rubric: 'EXPERIENCE',
      severity: 'POLISH',
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
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: `Images are not optimized (${Math.round(unoptImages.savings / 1024)}KB savings)`,
      evidence: `Image optimization could save ~${Math.round(unoptImages.savings / 1024)}KB`,
      fix: 'Convert images to WebP/AVIF format, compress them, and use Next.js <Image> for automatic optimization.',
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
      fix: 'Reduce main-thread work on interaction: defer non-critical JS, split long tasks, and optimize event handlers.',
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
      fix: 'Profile interactions in Chrome DevTools Performance panel and reduce JavaScript execution during input.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
