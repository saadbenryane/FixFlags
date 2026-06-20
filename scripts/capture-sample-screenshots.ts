/**
 * Capture marketing sample screenshots into public/samples/.
 * Run: npx tsx scripts/capture-sample-screenshots.ts
 *
 * Defaults to the demo fixture URL (fixflags.com/demo).
 */
import fs from 'fs/promises'
import path from 'path'
import puppeteer from 'puppeteer'
import { closeBrowser, captureScreenshots } from '../lib/audit/screenshot'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../lib/audit/viewports'
import { getLocalScreenshotPath } from '../lib/storage/screenshots'
import { DEFAULT_SAMPLE_AUDIT_URL } from '../lib/marketing/display-meta'

const AUDIT_ID = 'sample-demo-capture'
const CAPTURE_URL =
  process.env.SAMPLE_CAPTURE_URL ??
  process.env.SAMPLE_AUDIT_URL ??
  DEFAULT_SAMPLE_AUDIT_URL

const SETTLE_MS = 1500
const TIMEOUT_MS = 30_000
const OUT_DIR = path.join(process.cwd(), 'public', 'samples')

function captureBasename(rawUrl: string): string {
  try {
    const pathname = new URL(rawUrl).pathname.replace(/\/$/, '') || '/'
    if (pathname === '/demo/v1') return 'demo-v1'
    if (pathname === '/demo') return 'demo-original'
    return 'demo-original'
  } catch {
    return 'demo-original'
  }
}

function outputFilesForUrl(rawUrl: string) {
  const basename = captureBasename(rawUrl)
  return {
    basename,
    desktop: path.join(OUT_DIR, `${basename}-desktop.webp`),
    mobile: path.join(OUT_DIR, `${basename}-mobile.webp`),
  }
}

function isLocalCaptureUrl(raw: string): boolean {
  try {
    const hostname = new URL(raw.trim()).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')
  } catch {
    return false
  }
}

async function captureLocalScreenshots(targetUrl: string) {
  const outputFiles = outputFilesForUrl(targetUrl)
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  })

  async function captureViewport(
    outputPath: string,
    width: number,
    height: number,
    isMobile?: boolean,
    deviceScaleFactor?: number
  ) {
    const page = await browser.newPage()
    try {
      await page.setViewport({ width, height, isMobile, deviceScaleFactor })
      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_MS,
      })
      if (!response?.ok()) {
        throw new Error(`Capture returned HTTP ${response?.status() ?? 'unknown'}`)
      }
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
      const buffer = (await page.screenshot({
        type: 'webp',
        quality: 80,
        fullPage: false,
      })) as Buffer
      await fs.writeFile(outputPath, buffer)
      return true
    } finally {
      await page.close().catch(() => {})
    }
  }

  try {
    await fs.mkdir(OUT_DIR, { recursive: true })
    const [desktopOk, mobileOk] = await Promise.all([
      captureViewport(
        outputFiles.desktop,
        DESKTOP_VIEWPORT.width,
        DESKTOP_VIEWPORT.height
      ),
      captureViewport(
        outputFiles.mobile,
        MOBILE_VIEWPORT.width,
        MOBILE_VIEWPORT.height,
        true,
        MOBILE_VIEWPORT.deviceScaleFactor
      ),
    ])
    return { desktopOk, mobileOk, outputFiles }
  } finally {
    await browser.close()
  }
}

async function main() {
  const target = new URL(CAPTURE_URL).toString()
  const outputFiles = outputFilesForUrl(target)
  console.log(`Capturing ${target} → ${outputFiles.basename}-*.webp...`)

  if (isLocalCaptureUrl(target)) {
    const local = await captureLocalScreenshots(target)
    if (!local.desktopOk) {
      throw new Error('Desktop capture failed')
    }
    if (!local.mobileOk) {
      console.warn(`Mobile capture failed, ${local.outputFiles.basename}-mobile.webp not updated`)
    }
    console.log('Sample screenshots written to', OUT_DIR)
    return
  }

  process.env.NEXT_PUBLIC_APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

  const result = await captureScreenshots(target, AUDIT_ID)
  if (!result.desktopUrl) {
    throw new Error('Desktop capture failed')
  }
  if (!result.mobileUrl) {
    console.warn(`Mobile capture failed, ${outputFiles.basename}-mobile.webp not updated`)
  }
  await closeBrowser()

  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.copyFile(getLocalScreenshotPath(AUDIT_ID, 'desktop'), outputFiles.desktop)

  const mobilePath = getLocalScreenshotPath(AUDIT_ID, 'mobile')
  try {
    await fs.access(mobilePath)
    await fs.copyFile(mobilePath, outputFiles.mobile)
  } catch {
    console.warn(`Mobile screenshot file missing, ${outputFiles.basename}-mobile.webp not updated`)
  }

  console.log('Sample screenshots written to', OUT_DIR)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => closeBrowser())
