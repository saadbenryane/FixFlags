#!/usr/bin/env node
/**
 * Browser proof for the Product pane stage and docked transport.
 * Captures the homepage living emulation and a report route at three widths
 * and asserts the stage never resizes when the device toggle changes.
 *
 * Usage: node scripts/preview-stage-proof.mjs [baseUrl] [reportPath]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://localhost:3000'
const reportPath = process.argv[3] ?? null
const outDir = '.agents/artifacts/preview-stage'
const widths = [375, 768, 1280]

// The shell renders a desktop grid and a mobile stack, so at any width one of
// the two Product panes is display:none. Always measure the visible one.
async function stageBox(page) {
  return page.evaluate(() => {
    const transport = Array.from(
      document.querySelectorAll('[aria-label="Preview controls"]')
    ).find((node) => node.getBoundingClientRect().height > 0)
    if (!transport) return null
    const stage = transport.previousElementSibling
    if (!stage) return null
    const s = stage.getBoundingClientRect()
    const t = transport.getBoundingClientRect()
    return {
      stage: { w: Math.round(s.width), h: Math.round(s.height) },
      transport: { w: Math.round(t.width), h: Math.round(t.height) },
      // Docked means last row of the Product pane, directly under the stage.
      docked: transport.nextElementSibling === null,
    }
  })
}

async function run() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []

  const targets = [{ name: 'home', path: '/' }]
  if (reportPath) targets.push({ name: 'report', path: reportPath })

  for (const target of targets) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      await page.goto(`${base}${target.path}`, { waitUntil: 'networkidle' })
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
      await page.waitForTimeout(1200)

      // Completed reviews open on Report; small screens open on Agent.
      if ((await page.locator('[aria-label="Preview controls"]:visible').count()) === 0) {
        const tabs = page.getByRole('tab', { name: /^(Preview|Timeline)$/ })
        const count = await tabs.count()
        for (let i = 0; i < count; i += 1) {
          const tab = tabs.nth(i)
          if (!(await tab.isVisible())) continue
          await tab.click({ force: true })
          await page.waitForTimeout(250)
          if ((await page.locator('[aria-label="Preview controls"]:visible').count()) > 0) break
        }
        await page
          .locator('[aria-label="Preview controls"]:visible')
          .first()
          .waitFor({ state: 'visible', timeout: 5000 })
          .catch(() => {})
      }

      const chromeInChrome = await page.evaluate(() => {
        const transport = Array.from(
          document.querySelectorAll('[aria-label="Preview controls"]')
        ).find((node) => node.getBoundingClientRect().height > 0)
        if (!transport) return 'no-transport'
        const pane = transport.parentElement
        return pane?.querySelectorAll('.rounded-full.bg-muted-foreground\\/25').length ?? 0
      })

      const before = await stageBox(page)
      let after = null
      // Device control is icon-only; match the accessible name.
      const mobileTab = page.getByRole('tab', { name: 'Mobile' }).first()
      const mobileTabs = await mobileTab.count()
      if (mobileTabs > 0) {
        await mobileTab.click({ force: true })
        await page.waitForTimeout(500)
        after = await stageBox(page)
      }

      await page.screenshot({
        path: `${outDir}/${target.name}-${width}.png`,
        fullPage: false,
      })

      results.push({
        target: target.name,
        width,
        mobileTabs,
        chromeInChrome,
        before,
        after,
        stageStable:
          before && after
            ? before.stage.h === after.stage.h && before.stage.w === after.stage.w
            : null,
        transportDocked: before ? before.docked : null,
      })
      await page.close()
    }
  }

  await browser.close()
  console.log(JSON.stringify(results, null, 2))

  const failures = results.filter((row) => {
    if (row.chromeInChrome !== 0) return true
    if (!row.before || !row.before.docked) return true
    if (row.mobileTabs > 0 && row.stageStable !== true) return true
    return false
  })
  if (failures.length > 0) {
    console.error('preview-stage-proof failed', failures)
    process.exit(1)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
