import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const reportUrl = process.argv[2] ?? 'http://localhost:3000/report/cmtas0uwf0000gpr8o6p22xcp'
const widths = [375, 768, 1280]
const outDir = '.agents/artifacts/review-depth-truth'

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const findings: string[] = []
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto(reportUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(6000)
    const reportTab = page.locator('[role="tab"]').filter({ hasText: /^Report$/ }).first()
    if ((await reportTab.count()) > 0) {
      await reportTab.click({ timeout: 5_000 }).catch(() => undefined)
      await page.waitForTimeout(500)
    }
    const body = await page.locator('body').innerText()
    const coverage = /Reviewed this page and \d+ linked pages/.test(body)
    const partial = /Review was partial/.test(body)
    const onPages = /On \d+ pages/.test(body)
    const onPath = /On \//.test(body)
    const journeyBar = (await page.locator('[data-testid="journey-bar"]').count()) > 0
    const pageChips = await page.getByRole('button', { name: /All Pages|Filter by page/ }).count()
    findings.push(
      `${width}: coverage=${coverage} partial=${partial} onPages=${onPages} onPath=${onPath} journeyBar=${journeyBar} pageChips=${pageChips}`
    )
    await page.screenshot({ path: `${outDir}/report-${width}.png`, fullPage: false })
    await page.close()
  }
  await browser.close()
  console.log(findings.join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
