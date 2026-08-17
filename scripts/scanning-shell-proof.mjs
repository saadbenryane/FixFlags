#!/usr/bin/env node
/**
 * Browser proof for the live-review shell: starts a real anonymous review and
 * watches the Product pane while the transcript and Flags stream in, at three
 * widths. Fails loudly if the stage moves, the transport undocks, or fake
 * browser chrome appears inside the editor.
 *
 * Usage: node scripts/scanning-shell-proof.mjs [baseUrl] [targetUrl]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://localhost:3000'
const target = process.argv[3] ?? 'https://example.com'
const outDir = '.agents/artifacts/preview-stage'
const widths = [375, 768, 1280]

async function expectEnabled(locator) {
  await locator.waitFor({ state: 'visible', timeout: 20000 })
  for (let i = 0; i < 40; i += 1) {
    if (await locator.isEnabled()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Homepage URL field stayed disabled')
}

const measure = () =>
  // Desktop grid and mobile stack both render a Product pane; only one is laid out.
  Array.from(document.querySelectorAll('[aria-label="Preview controls"]'))
    .map((transport) => {
      const t = transport.getBoundingClientRect()
      if (t.height === 0) return null
      const stage = transport.previousElementSibling
      const s = stage.getBoundingClientRect()
      return {
        stage: { w: Math.round(s.width), h: Math.round(s.height) },
        transport: { h: Math.round(t.height) },
        docked: transport.nextElementSibling === null,
        fakeChrome: transport.parentElement.querySelectorAll(
          '.rounded-full.bg-muted-foreground\\/25'
        ).length,
      }
    })
    .find(Boolean) ?? null

async function run() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })

  const input = page.getByLabel('Website URL').first()
  await input.waitFor({ state: 'visible', timeout: 20000 })
  await expectEnabled(input)
  await input.fill(target)
  await page.getByRole('button', { name: 'Review my site' }).first().click()
  await page.waitForURL(/\/report\//, { timeout: 60000 })
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  console.log('scanning at', page.url())

  const samples = []
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(1500)

    // Small screens open on Agent; completed reviews open on Report.
    const previewTab = page.getByRole('tab', { name: /^(Preview|Timeline)$/ }).first()
    if (await previewTab.count()) await previewTab.click()
    await page
      .locator('[aria-label="Preview controls"]:visible')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {})

    // Kept short so all three widths are sampled inside one live review.
    const frames = []
    for (let i = 0; i < 6; i += 1) {
      frames.push(await page.evaluate(measure))
      await page.waitForTimeout(700)
    }

    const mobileTab = page.getByRole('tab', { name: 'Mobile' }).first()
    let afterDeviceSwitch = null
    if (await mobileTab.count()) {
      await mobileTab.click()
      await page.waitForTimeout(600)
      afterDeviceSwitch = await page.evaluate(measure)
    }

    await page.screenshot({ path: `${outDir}/scanning-${width}.png` })

    const heights = new Set(frames.filter(Boolean).map((f) => `${f.stage.w}x${f.stage.h}`))
    samples.push({
      width,
      observed: frames.filter(Boolean).length,
      stageSizes: [...heights],
      stageStableWhileStreaming: heights.size === 1,
      stageStableOnDeviceSwitch:
        afterDeviceSwitch && frames.at(-1)
          ? afterDeviceSwitch.stage.h === frames.at(-1).stage.h &&
            afterDeviceSwitch.stage.w === frames.at(-1).stage.w
          : null,
      transportDocked: frames.filter(Boolean).every((f) => f.docked),
      fakeChrome: frames.filter(Boolean).reduce((max, f) => Math.max(max, f.fakeChrome), 0),
    })
  }

  await browser.close()
  console.log(JSON.stringify(samples, null, 2))

  const failures = samples.filter((row) => {
    if (row.observed === 0) return true
    if (!row.stageStableWhileStreaming) return true
    if (row.stageStableOnDeviceSwitch === false) return true
    if (!row.transportDocked) return true
    if (row.fakeChrome > 0) return true
    return false
  })
  if (failures.length > 0) {
    console.error('scanning-shell-proof failed', failures)
    process.exit(1)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
