/**
 * Rendered-browser accuracy probe for geometry and interaction checks.
 *
 * Run the curated corpus:
 *   npm run accuracy:browser
 *
 * Probe arbitrary URLs without stored expectations:
 *   npm run accuracy:browser -- https://example.com
 */
import { writeFileSync } from 'node:fs'
import { ACCURACY_BROWSER_TARGETS } from '@/lib/audit/accuracy-browser-corpus'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { measureMobileLayout } from '@/lib/audit/capture-metrics'
import { runLayoutChecks } from '@/lib/audit/checks/layout'
import { closeBrowser, getAuditBrowser } from '@/lib/audit/screenshot'

const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const outPath = outIndex >= 0 ? args[outIndex + 1] : null
const urls = args.filter(
  (arg, index) => !arg.startsWith('--') && (outIndex < 0 || index !== outIndex + 1)
)
const targets =
  urls.length > 0
    ? urls.map((url) => ({
        url,
        expectedPrimaryCtaText: undefined,
        expectedAbsentCheckIds: [] as string[],
      }))
    : ACCURACY_BROWSER_TARGETS

async function main() {
  const browser = await getAuditBrowser()
  const results = []
  const failures: string[] = []

  try {
    for (const target of targets) {
      const session = await createAuditPage(browser, target.url, {
        profile: MOBILE_CAPTURE_PROFILE,
      })
      try {
        const metrics = await measureMobileLayout(session.page)
        const flags = runLayoutChecks(metrics)
        const checkIds = flags.map((flag) => flag.checkId)
        const result = {
          url: target.url,
          viewport: {
            width: MOBILE_CAPTURE_PROFILE.width,
            height: metrics.mobileViewportHeight,
          },
          primaryCta: {
            text: metrics.mobilePrimaryCtaText,
            topPx: metrics.mobilePrimaryCtaTopPx,
          },
          checkIds,
        }
        results.push(result)

        if (
          target.expectedPrimaryCtaText !== undefined &&
          metrics.mobilePrimaryCtaText !== target.expectedPrimaryCtaText
        ) {
          failures.push(
            `${target.url}: expected CTA ${JSON.stringify(target.expectedPrimaryCtaText)}, got ${JSON.stringify(metrics.mobilePrimaryCtaText)}`
          )
        }
        for (const checkId of target.expectedAbsentCheckIds) {
          if (checkIds.includes(checkId)) {
            failures.push(`${target.url}: known false positive ${checkId} is present`)
          }
        }
      } finally {
        await session.page.context().close()
      }
    }
  } finally {
    await closeBrowser().catch(() => {})
  }

  const payload = { generatedAt: new Date().toISOString(), results, failures }
  if (outPath) writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)

  console.log('FixFlags rendered-browser accuracy probe\n')
  for (const result of results) {
    console.log(
      `${result.url}\n  CTA=${JSON.stringify(result.primaryCta.text)} top=${result.primaryCta.topPx ?? 'none'}px viewport=${result.viewport.height}px flags=${result.checkIds.join(', ') || 'none'}`
    )
  }
  console.log(`\nFailures: ${failures.length}`)
  for (const failure of failures) console.error(`- ${failure}`)
  if (failures.length > 0) process.exitCode = 1
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
