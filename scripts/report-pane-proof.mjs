#!/usr/bin/env node
/**
 * Browser proof for the Report pane redesign.
 * Opens Report mode on the homepage emulation, /samples, and an optional live
 * report at three widths, then asserts the pane anatomy: one compact Score header, the
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
const widths = [320, 375, 768, 1280]

async function settleLayout(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function openReportMode(page) {
  await page.locator('[data-workspace-ready="true"]').first().waitFor({ state: 'visible', timeout: 60000 })
  const visibleReportTab = page
    .locator('[role="tab"]:visible')
    .filter({ hasText: /^Report$/ })
    .first()
  await visibleReportTab.waitFor({ state: 'visible', timeout: 60000 })
  const explorer = page.locator('[role="region"][aria-label^="Fix list with"]').first()
  if ((await visibleReportTab.getAttribute('aria-selected')) !== 'true') {
    await visibleReportTab.click()
  }
  await explorer.waitFor({ state: 'visible', timeout: 60000 })
  return true
}

async function measurePane(page) {
  return page.evaluate(() => {
    const visible = (node) => node.getBoundingClientRect().height > 0
    const scoreHeaders = Array.from(document.querySelectorAll('#report-status')).filter(visible)
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
    const comparisonFrames = Array.from(
      explorer[0]?.querySelectorAll('[data-comparison-state="affected"], [data-comparison-state="unaffected"]') ?? []
    ).filter(visible)
    const paneRect = pane?.getBoundingClientRect() ?? null
    const listRect = list?.getBoundingClientRect() ?? null
    const frameRect = frame?.getBoundingClientRect() ?? null

    return {
      scoreHeaders: scoreHeaders.length,
      hasVisibleScoreLabel: scoreHeaders.some((header) =>
        Array.from(header.querySelectorAll('*')).some(
          (node) => node.childElementCount === 0 && node.textContent?.trim() === 'Score' && visible(node)
        )
      ),
      hasLegacyScoreGauge: scoreHeaders.some((node) => Boolean(node.querySelector('svg circle'))),
      comparisonFrameCount: comparisonFrames.length,
      comparisonBordersInset: comparisonFrames.length > 0 && comparisonFrames.every((node) =>
        getComputedStyle(node).boxShadow.includes('inset')
      ),
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
  await page.waitForFunction((field) => field instanceof HTMLInputElement && !field.disabled, await input.elementHandle())
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
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await settleLayout(page)
      const openedTab = await openReportMode(page).catch(() => false)
      await settleLayout(page)
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
  try {
    const results = []

    const targets = [
      { name: 'home', path: '/' },
      { name: 'samples', path: '/samples' },
    ]
    if (reportPath) targets.push({ name: 'report', path: reportPath })

    for (const target of targets) {
      for (const width of widths) {
        console.log(`proving ${target.name}@${width}`)
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        try {
          // A cold dev route can take longer than Playwright's default to compile.
          page.setDefaultTimeout(60000)
          // Marketing pages keep polling and animating, so idle never arrives;
          // the Report tab and explorer waits below are the real readiness signal.
          const destination = new URL(target.path, base)
          destination.searchParams.set('view', 'report')
          await page.goto(destination.toString(), { waitUntil: 'domcontentloaded' })
          await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
          const openedTab = await openReportMode(page)
          await settleLayout(page)

          const measurement = await measurePane(page)
          results.push({ target: target.name, width, phase: 'static', openedTab, ...measurement })
          await page.screenshot({ path: `${outDir}/${target.name}-${width}.png`, fullPage: false })
        } finally {
          await page.close()
        }
      }
    }

    if (live) results.push(...(await proveLiveReview(browser)))

    await writeFile(`${outDir}/proof.json`, `${JSON.stringify(results, null, 2)}\n`)

    const failures = []
    for (const row of results) {
      const at = `${row.target}@${row.width}${row.phase === 'static' ? '' : ` (${row.phase})`}`
      // A scan can reach a width before its first Flag is confirmed, so the
      // explorer is only required once the review has something to rank.
      if (row.phase === 'scanning' ? row.explorers > 1 : row.explorers !== 1) {
        failures.push(`${at}: expected one fix explorer, saw ${row.explorers}`)
      }
      if (row.phase !== 'scanning' && row.scoreHeaders !== 1) {
        failures.push(`${at}: expected one Score header, saw ${row.scoreHeaders}`)
      }
      if (row.scoreHeaders > 0 && !row.hasVisibleScoreLabel) {
        failures.push(`${at}: Score header has no visible Score label`)
      }
      if (row.hasLegacyScoreGauge) failures.push(`${at}: circular score gauge returned`)
      if (row.comparisonFrameCount === 0) {
        failures.push(`${at}: no comparison frame was inspected`)
      } else if (row.comparisonBordersInset === false) {
        failures.push(`${at}: comparison border is external and can be clipped`)
      }
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
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
