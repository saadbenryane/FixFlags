import { getAuditBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { measureMobileLayout } from '@/lib/audit/capture-metrics'
import { runInteractionChecks } from '@/lib/audit/checks/interaction'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { runFlowScanStandalone } from '@/lib/audit/flow/run-flow-scan'

const url = process.argv[2] ?? 'https://saadbenryane.com'

async function main() {
  const browser = await getAuditBrowser()
  try {
    const { page } = await createAuditPage(browser, url, { profile: MOBILE_CAPTURE_PROFILE })
    const metrics = await measureMobileLayout(page)
    const interactionFlags = runInteractionChecks(metrics)
    await page.close()

    const flow = await runFlowScanStandalone(browser, 'smoke', url)
    const flowFlags = runFlowChecks(flow)

    const watchIds = new Set([
      'motion-ignores-reduced-preference',
      'flow-pricing-nav-broken',
      'flow-mobile-menu-broken',
      'flow-form-no-validation',
      'flow-no-cta-found',
      'flow-cta-dead-end',
    ])

    const flagged = [...interactionFlags, ...flowFlags].filter((f) => watchIds.has(f.checkId))
    console.log(`Smoke: ${url}`)
    console.log(`Flow status: ${flow.status}`)
    if (flagged.length === 0) {
      console.log('No false-positive-prone flags in watch set.')
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
