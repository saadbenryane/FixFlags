import fs from 'fs/promises'
import path from 'path'
import { chromium, type Browser, type Page } from 'playwright'
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

export interface EvidenceAnchorTarget {
  checkId: string
  problem?: string | null
  evidence?: string | null
}

const ANCHORS_PATH = path.join(process.cwd(), 'lib/marketing/sample-evidence-anchors.json')
const SETTLE_MS = 1500
const TIMEOUT_MS = 30_000
const ANCHOR_CLAMP_MIN = 0.02
const ANCHOR_CLAMP_MAX = 0.98

function normalizeTargets(
  targets: Array<string | EvidenceAnchorTarget | null | undefined>
): EvidenceAnchorTarget[] {
  const deduped = new Map<string, EvidenceAnchorTarget>()
  for (const target of targets) {
    if (!target) continue
    const normalized =
      typeof target === 'string'
        ? { checkId: target }
        : { ...target, checkId: target.checkId }
    if (!normalized.checkId) continue

    const existing = deduped.get(normalized.checkId)
    deduped.set(normalized.checkId, {
      checkId: normalized.checkId,
      problem: existing?.problem ?? normalized.problem ?? null,
      evidence: existing?.evidence ?? normalized.evidence ?? null,
    })
  }
  return [...deduped.values()]
}

async function resolveRect(
  page: Page,
  selectors: string[],
  target: EvidenceAnchorTarget
): Promise<EvidenceAnchor | null> {
  const checkId = target.checkId
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
    ({
      sels,
      min,
      max,
      targetContext,
    }: {
      sels: string[]
      min: number
      max: number
      targetContext: { checkId: string; problem: string; evidence: string }
    }) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()
      const contextText = `${targetContext.problem} ${targetContext.evidence}`
      const quotedNeedles = [...contextText.matchAll(/"([^"]{2,160})"/g)]
        .map((match) => normalize(match[1] ?? ''))
        .filter(Boolean)
      const urlNeedles = [...contextText.matchAll(/https?:\/\/[^\s;)]+/g)]
        .map((match) => match[0].replace(/[.,;:]+$/, ''))
        .filter(Boolean)
      const hashNeedles = [...contextText.matchAll(/#[a-z0-9_-]+/gi)]
        .map((match) => match[0].toLowerCase())
        .filter(Boolean)

      const candidateScore = (el: Element, selectorIndex: number, rect: DOMRect) => {
        const htmlEl = el as HTMLElement
        const text = normalize(htmlEl.innerText || htmlEl.textContent || '')
        const href = el instanceof HTMLAnchorElement ? el.href : ''
        const src = el instanceof HTMLImageElement ? el.currentSrc || el.src : ''
        const id = el.id ? `#${el.id.toLowerCase()}` : ''
        const aria = normalize(el.getAttribute('aria-label') || '')
        const name = normalize(el.getAttribute('name') || '')

        let score = 0
        for (const needle of quotedNeedles) {
          if (needle && (text.includes(needle) || aria.includes(needle) || name.includes(needle))) {
            score += 120
          }
        }
        for (const url of urlNeedles) {
          if (href === url || href.includes(url) || src === url || src.includes(url)) {
            score += 140
          } else {
            try {
              const urlPath = new URL(url).pathname
              if (urlPath && (href.endsWith(urlPath) || src.endsWith(urlPath))) score += 100
            } catch {}
          }
        }
        for (const hash of hashNeedles) {
          const rawHref = el instanceof HTMLAnchorElement ? el.getAttribute('href') ?? '' : ''
          if (rawHref.toLowerCase() === hash || id === hash) score += 130
        }

        if (/h1-(generic|multiple)|title-too|title-missing/.test(targetContext.checkId)) {
          if (el.tagName.toLowerCase() === 'h1') score += 80
        }
        if (/cta|button|inp/.test(targetContext.checkId)) {
          if (el.matches('a[href], button, [role="button"]')) score += 55
        }
        if (/image|lcp|unoptimized/.test(targetContext.checkId)) {
          if (el.tagName.toLowerCase() === 'img') score += 55
        }
        if (/form|input/.test(targetContext.checkId)) {
          if (el.matches('input, textarea, select')) score += 55
          if (el.tagName.toLowerCase() === 'form') score += 30
        }

        const areaRatio = (rect.width * rect.height) / Math.max(1, window.innerWidth * window.innerHeight)
        const selectorPenalty = selectorIndex * 4
        const hugePenalty = areaRatio > 0.55 ? 60 : areaRatio > 0.3 ? 24 : 0
        const tinyPenalty = rect.width < 8 || rect.height < 8 ? 120 : 0

        return score + Math.max(0, 45 - areaRatio * 100) - selectorPenalty - hugePenalty - tinyPenalty
      }

      let best:
        | {
            rect: { left: number; top: number; right: number; bottom: number }
            score: number
          }
        | null = null

      for (const sel of sels) {
        const selectorIndex = sels.indexOf(sel)
        for (const el of document.querySelectorAll(sel)) {
          const rect = el.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) continue
          const style = window.getComputedStyle(el)
          if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue
          const vw = window.innerWidth
          const vh = window.innerHeight
          if (vw <= 0 || vh <= 0) continue
          if (rect.bottom < 0 || rect.top > vh) continue

          const score = candidateScore(el, selectorIndex, rect)
          if (!best || score > best.score) {
            best = {
              rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
              score,
            }
          }
        }
      }

      if (!best) return null

      const rect = best.rect
      const vw = window.innerWidth
      const vh = window.innerHeight
      const widthPx = rect.right - rect.left
      const heightPx = rect.bottom - rect.top
      const padX = Math.min(widthPx * 0.08, 12)
      const padY = Math.min(heightPx * 0.12, 10)
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
    },
    {
      sels: selectors,
      min: ANCHOR_CLAMP_MIN,
      max: ANCHOR_CLAMP_MAX,
      targetContext: {
        checkId,
        problem: target.problem ?? '',
        evidence: target.evidence ?? '',
      },
    }
  )
}

async function resolveForDevice(
  browser: Browser,
  url: string,
  device: EvidenceDevice,
  targets: EvidenceAnchorTarget[]
): Promise<EvidenceAnchorMap> {
  const context = await browser.newContext(
    device === 'mobile'
      ? {
          viewport: { width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height },
          isMobile: true,
          deviceScaleFactor: MOBILE_VIEWPORT.deviceScaleFactor,
        }
      : {
          viewport: { width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height },
        }
  )
  const page = await context.newPage()
  const result: EvidenceAnchorMap = {}

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS,
    })
    if (!response?.ok()) {
      throw new Error(`Navigation failed with HTTP ${response?.status() ?? 'unknown'}`)
    }
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
    await page.evaluate(() => window.scrollTo(0, 0))

    for (const target of targets) {
      const checkId = target.checkId
      const entry = getEvidenceSelectors(checkId)
      if (!entry) continue
      if (entry.device !== 'both' && entry.device !== device) continue

      const point = await resolveRect(page, entry.selectors, target)
      if (!point) continue

      result[checkId] = { ...result[checkId], [device]: point }
    }
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
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

export async function resolveEvidenceAnchorsWithBrowser(
  browser: Browser,
  options: {
    url: string
    checkIds?: string[]
    targets?: Array<string | EvidenceAnchorTarget | null | undefined>
  }
): Promise<EvidenceAnchorMap> {
  const url = new URL(options.url).toString()
  const targets = normalizeTargets(options.targets ?? options.checkIds ?? [])

  const desktopTargets = targets.filter((target) => devicesForCheck(target.checkId).includes('desktop'))
  const mobileTargets = targets.filter((target) => devicesForCheck(target.checkId).includes('mobile'))

  const [desktop, mobile] = await Promise.all([
    desktopTargets.length > 0 ? resolveForDevice(browser, url, 'desktop', desktopTargets) : {},
    mobileTargets.length > 0 ? resolveForDevice(browser, url, 'mobile', mobileTargets) : {},
  ])

  return mergeAnchorMaps(desktop, mobile)
}

export async function resolveEvidenceAnchors(options: {
  url?: string
  checkIds?: string[]
  targets?: Array<string | EvidenceAnchorTarget | null | undefined>
}): Promise<EvidenceAnchorMap> {
  const url = new URL(options.url ?? DEFAULT_SAMPLE_AUDIT_URL).toString()
  const targets = normalizeTargets(options.targets ?? options.checkIds ?? [])

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  })

  try {
    return await resolveEvidenceAnchorsWithBrowser(browser, { url, targets })
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
