#!/usr/bin/env node
/**
 * Live inspection of the living-review editor surfaces.
 * Writes screenshots + a JSON readout. Does not start a scan.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://localhost:3000'
const reportPath = process.argv[3] ?? null
const outDir = '.agents/artifacts/living-review-inspect'
const widths = [375, 768, 1280]

async function inspect(page) {
  return page.evaluate(() => {
    const hide = (sel) =>
      document.querySelectorAll(sel).forEach((n) => {
        if (n instanceof HTMLElement) n.style.display = 'none'
      })
    hide('nextjs-portal')

    const visible = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }

    const transports = Array.from(
      document.querySelectorAll('[aria-label="Preview controls"]')
    ).filter(visible)

    const transport = transports[0] ?? null
    const stage = transport?.previousElementSibling ?? null
    const pane = transport?.parentElement ?? null
    const img = stage?.querySelector('img') ?? null
    const viewport = document.querySelector('[aria-label="Viewport"]')
    const deviceInTransport = Boolean(
      transport?.querySelector('[aria-label="Viewport"]')
    )
    const fakeChrome = pane
      ? pane.querySelectorAll('.rounded-full.bg-muted-foreground\\/25').length
      : -1

    const headerText = pane
      ? Array.from(pane.querySelectorAll('header, :scope > div:first-child'))
          .slice(0, 1)
          .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim())
          .join('')
      : ''

    const viewTabs = Array.from(
      document.querySelectorAll('[aria-label="Workspace view"] [role="tab"]')
    )
      .filter(visible)
      .map((t) => ({
        label: t.getAttribute('aria-label'),
        selected: t.getAttribute('aria-selected'),
      }))

    const mobileTabs = Array.from(
      document.querySelectorAll('[role="tablist"] [role="tab"]')
    )
      .filter(visible)
      .map((t) => ({
        label: (t.textContent || '').trim(),
        selected: t.getAttribute('aria-selected'),
      }))

    const identity = (document.body.innerText || '').match(/Launchpad|fixflags\.com\/demo/g) || []

    return {
      transportCount: transports.length,
      stage: stage
        ? {
            w: Math.round(stage.getBoundingClientRect().width),
            h: Math.round(stage.getBoundingClientRect().height),
            className: stage.className,
          }
        : null,
      transport: transport
        ? {
            w: Math.round(transport.getBoundingClientRect().width),
            h: Math.round(transport.getBoundingClientRect().height),
            docked: transport.nextElementSibling === null,
            text: (transport.textContent || '').replace(/\s+/g, ' ').trim(),
          }
        : null,
      img: img
        ? {
            src: img.getAttribute('src'),
            w: Math.round(img.getBoundingClientRect().width),
            h: Math.round(img.getBoundingClientRect().height),
            naturalW: img.naturalWidth,
            naturalH: img.naturalHeight,
          }
        : null,
      deviceToggleVisible: Boolean(viewport && visible(viewport)),
      deviceInTransport,
      fakeChrome,
      headerText: headerText.slice(0, 160),
      viewTabs,
      mobileTabs,
      identityHits: identity.slice(0, 8),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      title: document.title,
    }
  })
}

async function openPreview(page) {
  const preview = page.getByRole('tab', { name: /^(Preview|Timeline)$/ }).first()
  if (await preview.count()) {
    await preview.click().catch(() => {})
    await page.waitForTimeout(400)
  }
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
      await page.goto(`${base}${target.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
      await page.waitForTimeout(900)
      if (target.name !== 'home' || width < 1024) await openPreview(page)
      // Homepage small screens now default to Product; keep that surface.
      const before = await inspect(page)
      await page.screenshot({ path: `${outDir}/${target.name}-${width}.png` })

      let after = null
      const mobile = page.getByRole('tab', { name: 'Mobile' }).first()
      if (await mobile.count()) {
        await mobile.click({ force: true }).catch(() => {})
        await page.waitForTimeout(500)
        after = await inspect(page)
        await page.screenshot({ path: `${outDir}/${target.name}-${width}-mobile.png` })
      }

      results.push({
        target: target.name,
        width,
        before,
        after,
        stageStable:
          before.stage && after?.stage
            ? before.stage.w === after.stage.w && before.stage.h === after.stage.h
            : null,
      })
      await page.close()
    }
  }

  await browser.close()
  const { writeFile } = await import('node:fs/promises')
  await writeFile(`${outDir}/inspect.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
