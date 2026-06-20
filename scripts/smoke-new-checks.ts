/**
 * Quick false-positive smoke for new checks on a real site.
 * Run: DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/smoke-new-checks.ts [url]
 */
import { getAuditBrowser, closeBrowser } from '@/lib/audit/screenshot'
import { fetchAndParseMetadata } from '@/lib/audit/metadata'
import { runAllChecks } from '@/lib/audit/checks'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { runFlowScanStandalone } from '@/lib/audit/flow/run-flow-scan'
import { measureMobileLayout } from '@/lib/audit/capture-metrics'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'

const NEW_CHECK_IDS = [
  'flow-pricing-nav-broken',
  'flow-mobile-menu-broken',
  'flow-form-no-validation',
  'motion-ignores-reduced-preference',
] as const

const url = process.argv[2] ?? 'https://saadbenryane.com'

async function main() {
  console.log(`Smoke: new checks on ${url}\n`)

  const metadata = await fetchAndParseMetadata(url)
  const browser = await getAuditBrowser()

  let consoleErrors: Array<{ type: string; text: string }> = []
  let captureMetrics = null

  try {
    const session = await createAuditPage(browser, url, {
      profile: MOBILE_CAPTURE_PROFILE,
    })
    const page = session.page
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push({ type: 'error', text: msg.text() })
    })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {})
    captureMetrics = await measureMobileLayout(page)
    await page.close()
  } catch (err) {
    console.warn('Mobile capture skipped:', err)
  }

  const { flags: detFlags } = await runAllChecks(
    url,
    metadata,
    null,
    null,
    consoleErrors,
    undefined,
    captureMetrics
  )
  const flowResult = await runFlowScanStandalone(browser, 'smoke-fp', url)
  const flowFlags = runFlowChecks(flowResult)
  const all = [...detFlags, ...flowFlags]

  let anyNew = false
  for (const checkId of NEW_CHECK_IDS) {
    const hits = all.filter((f) => f.checkId === checkId)
    console.log(`${checkId}: ${hits.length}`)
    for (const f of hits) {
      console.log(`  [${f.severity}] ${f.problem}`)
      console.log(`  evidence: ${f.evidence}`)
    }
    if (hits.length) anyNew = true
  }

  if (!anyNew) {
    console.log('\nNo false positives from new checks.')
  } else {
    console.log('\nReview flags above for defensibility.')
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => closeBrowser().catch(() => {}))
