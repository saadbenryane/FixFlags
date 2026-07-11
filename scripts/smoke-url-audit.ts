import { getAuditBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { measureMobileLayout } from '@/lib/audit/capture-metrics'
import { runInteractionChecks } from '@/lib/audit/checks/interaction'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { runLayoutChecks } from '@/lib/audit/checks/layout'
import { runFlowScanStandalone } from '@/lib/audit/flow/run-flow-scan'

const url = process.argv[2] ?? 'https://saadbenryane.com'

async function main() {
  const browser = await getAuditBrowser()
  try {
    const { page } = await createAuditPage(browser, url, { profile: MOBILE_CAPTURE_PROFILE })
    const metrics = await measureMobileLayout(page)
    const layoutFlags = runLayoutChecks(metrics)
    const interactionFlags = runInteractionChecks(metrics)
    await page.close()

    const flow = await runFlowScanStandalone(browser, 'smoke', url)
    const flowFlags = runFlowChecks(flow)

    const watchIds = new Set([
      'cta-below-fold-mobile',
      'loading-state-slow',
      'loading-indicator-stuck',
      'motion-ignores-reduced-preference',
      'flow-pricing-nav-broken',
      'flow-mobile-menu-broken',
      'flow-form-no-validation',
      'flow-no-cta-found',
      'flow-cta-dead-end',
    ])

    const flagged = [...layoutFlags, ...interactionFlags, ...flowFlags].filter((f) =>
      watchIds.has(f.checkId)
    )
    console.log(`Smoke: ${url}`)
    console.log(`Mobile CTA: "${metrics.mobilePrimaryCtaText}" at ${metrics.mobilePrimaryCtaTopPx}px (viewport ${metrics.mobileViewportHeight}px)`)
    const load = metrics.loadExperience
    if (load) {
      console.log(
        `Loading: clearedMs=${load.loadingClearedMs} label="${load.loadingLabel}" initial=${load.loadingVisibleAtInitial} final=${load.loadingVisibleAtFinal}`
      )
    }
    console.log(`Flow status: ${flow.status} finalUrl=${flow.finalUrl}`)
    if (flow.ctaText) console.log(`Flow CTA: "${flow.ctaText}" → ${flow.ctaHref ?? ''}`)
    if (flagged.length === 0) {
      console.log('No watch-set flags fired.')
    } else {
      for (const f of flagged) {
        console.log(`  [${f.severity}] ${f.checkId}: ${f.problem}`)
        console.log(`    evidence: ${f.evidence}`)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
