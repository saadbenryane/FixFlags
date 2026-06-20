import fs from 'fs/promises'
import path from 'path'
import puppeteer, { type Browser, type Page } from 'puppeteer'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '@/lib/audit/viewports'
import { DEFAULT_SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import {
  devicesForCheck,
  getEvidenceSelectors,
  type EvidenceDevice,
} from '@/lib/marketing/evidence-selectors'
import {
  anchorToRegion,
  evidenceScopeForCheck,
  type EvidenceRegionScope,
} from '@/lib/marketing/evidence-regions'

export interface EvidenceAnchor {
  x: number
  y: number
  width?: number
  height?: number
  scope?: EvidenceRegionScope
}

export type EvidenceAnchorEntry = Partial<Record<EvidenceDevice, EvidenceAnchor>>

export type EvidenceAnchorMap = Record<string, EvidenceAnchorEntry>

const ANCHORS_PATH = path.join(process.cwd(), 'lib/marketing/sample-evidence-anchors.json')
const SETTLE_MS = 1500
const TIMEOUT_MS = 30_000
const ANCHOR_CLAMP_MIN = 0.02
const ANCHOR_CLAMP_MAX = 0.98

async function resolveRect(
  page: Page,
  selectors: string[],
  checkId: string
): Promise<EvidenceAnchor | null> {
  const scope = evidenceScopeForCheck(checkId)
  if (scope === 'page') {
    const region = anchorToRegion(checkId, null)
    return {
      x: region.x + region.width / 2,
      y: region.y + region.height / 2,
      width: region.width,
      height: region.height,
      scope: 'page',
    }
  }

  return page.evaluate(
    (sels: string[], min: number, max: number) => {
      for (const sel of sels) {
        const el = document.querySelector(sel)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 && rect.height <= 0) continue
        const vw = window.innerWidth
        const vh = window.innerHeight
        if (vw <= 0 || vh <= 0) continue
        if (rect.bottom < 0 || rect.top > vh) continue

        const padX = Math.min(rect.width * 0.08, 12)
        const padY = Math.min(rect.height * 0.12, 10)
        const left = Math.max(0, rect.left - padX)
        const top = Math.max(0, rect.top - padY)
        const right = Math.min(vw, rect.right + padX)
        const bottom = Math.min(vh, rect.bottom + padY)

        const width = (right - left) / vw
        const height = (bottom - top) / vh
        const x = (left + (right - left) / 2) / vw
        const y = (top + (bottom - top) / 2) / vh

        return {
          x: Math.min(max, Math.max(min, x)),
          y: Math.min(max, Math.max(min, y)),
          width: Math.min(1, Math.max(0.06, width)),
          height: Math.min(1, Math.max(0.05, height)),
          scope: 'element' as const,
        }
      }
      return null
    },
    selectors,
    ANCHOR_CLAMP_MIN,
    ANCHOR_CLAMP_MAX
  )
}

async function resolveForDevice(
  browser: Browser,
  url: string,
  device: EvidenceDevice,
  checkIds: string[]
): Promise<EvidenceAnchorMap> {
  const viewport =
    device === 'mobile'
      ? {
          width: MOBILE_VIEWPORT.width,
          height: MOBILE_VIEWPORT.height,
          isMobile: true,
          deviceScaleFactor: MOBILE_VIEWPORT.deviceScaleFactor,
        }
      : { width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height }

  const page = await browser.newPage()
  const result: EvidenceAnchorMap = {}

  try {
    await page.setViewport(viewport)
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS,
    })
    if (!response?.ok()) {
      throw new Error(`Navigation failed with HTTP ${response?.status() ?? 'unknown'}`)
    }
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
    await page.evaluate(() => window.scrollTo(0, 0))

    for (const checkId of checkIds) {
      const entry = getEvidenceSelectors(checkId)
      if (!entry) continue
      if (entry.device !== 'both' && entry.device !== device) continue

      const point = await resolveRect(page, entry.selectors, checkId)
      if (!point) continue

      result[checkId] = { ...result[checkId], [device]: point }
    }
  } finally {
    await page.close().catch(() => {})
  }

  return result
}

function mergeAnchorMaps(...maps: EvidenceAnchorMap[]): EvidenceAnchorMap {
  const merged: EvidenceAnchorMap = {}
  for (const map of maps) {
    for (const [checkId, entry] of Object.entries(map)) {
      merged[checkId] = { ...merged[checkId], ...entry }
    }
  }
  return merged
}

export async function resolveEvidenceAnchors(options: {
  url?: string
  checkIds: string[]
}): Promise<EvidenceAnchorMap> {
  const url = new URL(options.url ?? DEFAULT_SAMPLE_AUDIT_URL).toString()
  const checkIds = [...new Set(options.checkIds.filter(Boolean))]

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  })

  try {
    const desktopIds = checkIds.filter((id) => devicesForCheck(id).includes('desktop'))
    const mobileIds = checkIds.filter((id) => devicesForCheck(id).includes('mobile'))

    const [desktop, mobile] = await Promise.all([
      desktopIds.length > 0 ? resolveForDevice(browser, url, 'desktop', desktopIds) : {},
      mobileIds.length > 0 ? resolveForDevice(browser, url, 'mobile', mobileIds) : {},
    ])

    return mergeAnchorMaps(desktop, mobile)
  } finally {
    await browser.close()
  }
}

export async function writeEvidenceAnchorsFile(
  anchors: EvidenceAnchorMap,
  filePath: string = ANCHORS_PATH
): Promise<void> {
  const sorted = Object.fromEntries(
    Object.entries(anchors).sort(([a], [b]) => a.localeCompare(b))
  )
  await fs.writeFile(filePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}

export async function readEvidenceAnchorsFile(
  filePath: string = ANCHORS_PATH
): Promise<EvidenceAnchorMap> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as EvidenceAnchorMap
  } catch {
    return {}
  }
}

async function main() {
  const checkIds = process.argv.slice(2)
  if (checkIds.length === 0) {
    console.error('Usage: tsx lib/marketing/resolve-evidence-anchors.ts <checkId> [...]')
    process.exit(1)
  }

  const url = process.env.SAMPLE_AUDIT_URL ?? DEFAULT_SAMPLE_AUDIT_URL
  console.log(`Resolving ${checkIds.length} anchors on ${url}...`)
  const fresh = await resolveEvidenceAnchors({ url, checkIds })
  const existing = await readEvidenceAnchorsFile()
  const merged = { ...existing, ...fresh }
  await writeEvidenceAnchorsFile(merged)
  console.log(`Wrote ${Object.keys(merged).length} anchors to ${ANCHORS_PATH}`)
}

if (process.argv[1]?.includes('resolve-evidence-anchors')) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
