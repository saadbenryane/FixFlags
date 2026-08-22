/** Generate the immutable, repository-owned curated sample bundle. */
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Browser } from 'playwright'
import sharp from 'sharp'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../lib/audit/viewports'
import { resolveEvidenceAnchorsWithBrowser } from '../lib/marketing/resolve-evidence-anchors'
import { getStaticSampleCaptureDefinitions } from '../lib/marketing/static-sample'

const BASE_URL = process.env.SAMPLE_CAPTURE_BASE_URL ?? 'http://127.0.0.1:3000'
const TIMEOUT_MS = 30_000
const MANIFEST_PATH = path.join(process.cwd(), 'lib', 'marketing', 'sample-evidence-anchors.json')

function sha256(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex')
}

async function waitForStableDocument(page: import('playwright').Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(
    async () => {
      const images = Array.from(document.images)
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
      await document.fonts.ready
      return document.readyState !== 'loading' && images.every((image) => image.complete)
    },
    undefined,
    { timeout: TIMEOUT_MS }
  )
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function capture(
  browser: Browser,
  url: string,
  outputPath: string,
  viewport: { width: number; height: number },
  mobile: boolean
) {
  const context = await browser.newContext({
    viewport,
    isMobile: mobile,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS })
    if (!response?.ok()) throw new Error(`${url} returned HTTP ${response?.status() ?? 'unknown'}`)
    await page.addStyleTag({
      content: 'nextjs-portal{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}',
    })
    await waitForStableDocument(page)
    const png = await page.screenshot({ type: 'png', fullPage: false })
    const webp = await sharp(png).webp({ quality: 92 }).toBuffer()
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, webp)
    return { sha256: sha256(webp), documentSha256: sha256(await page.content()) }
  } finally {
    await context.close()
  }
}

async function main() {
  const base = new URL(BASE_URL)
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) {
    throw new Error('Curated sample generation only accepts a local repository server')
  }
  const definitions = getStaticSampleCaptureDefinitions()
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  const observations: Record<string, unknown> = {}

  try {
    for (const definition of definitions) {
      const url = new URL(definition.sourcePath, base).toString()
      const publicDirectory = `/samples/observations/${definition.id}`
      const desktopPath = `${publicDirectory}/desktop.webp`
      const mobilePath = `${publicDirectory}/mobile.webp`
      const desktop = await capture(
        browser,
        url,
        path.join(process.cwd(), 'public', desktopPath),
        DESKTOP_VIEWPORT,
        false
      )
      const mobile = await capture(
        browser,
        url,
        path.join(process.cwd(), 'public', mobilePath),
        { width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height },
        true
      )
      const anchors = await resolveEvidenceAnchorsWithBrowser(browser, {
        url,
        targets: definition.anchorTargets,
      })
      observations[definition.id] = {
        revision: definition.revision,
        sourcePath: definition.sourcePath,
        reviewedAt: definition.completedAt,
        documentSha256: desktop.documentSha256,
        score: definition.score,
        flagIds: definition.flagIds,
        timeline: definition.timeline,
        captures: {
          desktop: { path: desktopPath, sha256: desktop.sha256, width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height },
          mobile: { path: mobilePath, sha256: mobile.sha256, width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height },
        },
        anchors,
      }
      process.stdout.write(`captured ${definition.id} from ${definition.sourcePath}\n`)
    }
  } finally {
    await browser.close()
  }

  const manifest = {
    schemaVersion: 1,
    generatedBy: 'scripts/capture-sample-screenshots.ts',
    observations,
  }
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  process.stdout.write(`wrote ${definitions.length} complete curated observations\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
