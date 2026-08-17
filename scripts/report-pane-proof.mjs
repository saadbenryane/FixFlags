#!/usr/bin/env node
/**
 * Browser proof for the Report pane redesign.
 * Opens Report mode on the homepage emulation, /samples, and an optional live
 * report at three widths, then asserts the pane anatomy: one outcome bar, the
 * fix list reachable without scrolling, list and detail scrolling inside the
 * pane, and Review context collapsed by default.
 *
 * Usage: node scripts/report-pane-proof.mjs [baseUrl] [reportPath]
 *        node scripts/report-pane-proof.mjs [baseUrl] --live [targetUrl]
 *
 * `--live` starts a real anonymous review from the homepage and measures the
 * Report pane while it scans and again once it completes.
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://localhost:3000'
const live = process.argv[3] === '--live'
const reportPath = live ? null : process.argv[3] ?? null
const liveTarget = live ? process.argv[4] ?? 'https://example.com' : null
const outDir = '.agents/artifacts/report-pane'
const widths = [375, 768, 1280]

async function openReportMode(page) {
  const tabs = page.getByRole('tab', { name: 'Report' })
  // The toggle renders server-side but only responds once React hydrates, so a
  // single click can land on inert markup. Retry until Report actually opens.
  await tabs.first().waitFor({ state: 'visible', timeout: 60000 })
  const explorer = page.locator('[role="region"][aria-label^="Fix list with"]').first()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const count = await tabs.count()
    for (let i = 0; i < count; i += 1) {
      const tab = tabs.nth(i)
      if (await tab.isVisible()) await tab.click({ force: true })
    }
    if (await explorer.isVisible().catch(() => false)) return true
    await page.waitForTimeout(1500)
  }
  return await explorer.isVisible().catch(() => false)
}

async function measurePane(page) {
  return page.evaluate(() => {
    const visible = (node) => node.getBoundingClientRect().height > 0
    const bar = Array.from(document.querySelectorAll('#report-status')).filter(visible)
    const explorer = Array.from(
      document.querySelectorAll('[role="region"][aria-label^="Fix list with"]')
    ).filter(visible)
    const details = Array.from(document.querySelectorAll('details')).filter(visible)
    const pane = explorer[0]?.closest('.overflow-y-auto') ?? null
    const list = explorer[0]?.querySelector('[aria-label="Report Flags"]')?.closest('div') ?? null
    // Measure the detail that belongs to the visible explorer, never a copy.
    const detail = explorer[0]?.querySelector('#selected-flag-detail') ?? null
    const duplicateIds = ['report-status', 'report-flags', 'selected-flag-detail'].filter(
      (id) => document.querySelectorAll(`#${id}`).length > 1
    )
    const scrolls = (node) =>
      node ? ['auto', 'scroll'].includes(getComputedStyle(node).overflowY) : false
    const frame = explorer[0]?.closest('[data-report-frame]') ?? null
    const paneRect = pane?.getBoundingClientRect() ?? null
    const listRect = list?.getBoundingClientRect() ?? null
    const frameRect = frame?.getBoundingClientRect() ?? null

    return {
      outcomeBars: bar.length,
      explorers: explorer.length,
      duplicateIds,
      // 40rem is the container breakpoint where the explorer becomes master/detail.
      paneWidth: paneRect ? Math.round(paneRect.width) : null,
      splitMode: paneRect ? paneRect.width >= 640 : null,
      contextDisclosures: details.length,
      contextOpen: details.some((node) => node.open),
      paneScrollTop: pane?.scrollTop ?? null,
      paneScrollable: pane ? pane.scrollHeight > pane.clientHeight + 1 : null,
      // In split mode the frame must fit one pane height so only its columns scroll.
      frameFitsPane:
        frameRect && paneRect ? frameRect.height <= paneRect.height + 2 : null,
      // The fix list must be inside the first pane height, never below the fold.
      listWithinFirstScreen:
        paneRect && listRect ? listRect.top < paneRect.bottom : null,
      listScrolls: scrolls(list),
      detailScrolls: scrolls(detail),
      fixPromptVisible: Boolean(
        detail && detail.textContent && /Fix/.test(detail.textContent)
      ),
    }
  })
}

/**
 * Runs one real anonymous review and measures the Report pane twice: while the
 * scan streams in, and after it completes in the same shell.
 */
async function proveLiveReview(browser) {
  const rows = []
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(60000)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })

  const input = page.getByLabel('Website URL').first()
  await input.waitFor({ state: 'visible', timeout: 20000 })
  for (let i = 0; i < 60 && !(await input.isEnabled()); i += 1) await page.waitForTimeout(100)
  await input.fill(liveTarget)
  await page.getByRole('button', { name: 'Review my site' }).first().click()
  await page.waitForURL(/\/report\//, { timeout: 60000 })
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  console.log('live review at', page.url())

  for (const phase of ['scanning', 'completed']) {
    if (phase === 'completed') {
      // The completed hold frame is the first state that renders Review context.
      await page.setViewportSize({ width: 1280, height: 900 })
      await page
        .locator('details:visible')
        .first()
        .waitFor({ state: 'visible', timeout: 300000 })
      await page.waitForTimeout(1500)
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(800)
      const openedTab = await openReportMode(page).catch(() => false)
      await page.waitForTimeout(500)
      rows.push({ target: 'live', width, phase, openedTab, ...(await measurePane(page)) })
      await page.screenshot({ path: `${outDir}/live-${phase}-${width}.png` })
    }
  }

  await page.close()
  return rows
}

async function run() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []

  const targets = [
    { name: 'home', path: '/' },
    { name: 'samples', path: '/samples' },
  ]
  if (reportPath) targets.push({ name: 'report', path: reportPath })

  for (const target of targets) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      // A cold dev route can take longer than Playwright's default to compile.
      page.setDefaultTimeout(60000)
      // Marketing pages keep polling and animating, so idle never arrives;
      // the Report tab and explorer waits below are the real readiness signal.
      await page.goto(`${base}${target.path}`, { waitUntil: 'domcontentloaded' })
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
      await page.waitForTimeout(1200)
      const openedTab = await openReportMode(page)
      await page.waitForTimeout(600)

      const measurement = await measurePane(page)
      results.push({ target: target.name, width, phase: 'static', openedTab, ...measurement })
      await page.screenshot({ path: `${outDir}/${target.name}-${width}.png`, fullPage: false })
      await page.close()
    }
  }

  if (live) results.push(...(await proveLiveReview(browser)))

  await browser.close()
  await writeFile(`${outDir}/proof.json`, `${JSON.stringify(results, null, 2)}\n`)

  const failures = []
  for (const row of results) {
    const at = `${row.target}@${row.width}${row.phase === 'static' ? '' : ` (${row.phase})`}`
    // A scan can reach a width before its first Flag is confirmed, so the
    // explorer is only required once the review has something to rank.
    if (row.phase === 'scanning' ? row.explorers > 1 : row.explorers !== 1) {
      failures.push(`${at}: expected one fix explorer, saw ${row.explorers}`)
    }
    if (row.outcomeBars > 1) failures.push(`${at}: ${row.outcomeBars} outcome bars`)
    if (row.contextOpen) failures.push(`${at}: review context is expanded by default`)
    if (row.duplicateIds?.length) {
      failures.push(`${at}: duplicated report ids ${row.duplicateIds.join(', ')}`)
    }
    if (row.listWithinFirstScreen === false) {
      failures.push(`${at}: fix list starts below the visible pane`)
    }
    // Wide panes split into two independently scrolling columns; narrow panes
    // stack and scroll as one pane, so only the split case must scroll inside.
    if (row.splitMode && !row.detailScrolls) {
      failures.push(`${at}: detail column does not scroll inside the pane`)
    }
    if (row.splitMode && row.frameFitsPane === false) {
      failures.push(`${at}: report frame overflows the pane instead of scrolling by column`)
    }
  }

  console.log(JSON.stringify(results, null, 2))
  if (failures.length) {
    console.error(`\nReport pane proof failed:\n${failures.map((f) => `  ${f}`).join('\n')}`)
    process.exitCode = 1
  } else {
    console.log('\nReport pane proof passed.')
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
