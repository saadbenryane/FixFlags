import type { Page } from 'playwright'
import { evidenceScopeForCheck } from '@/lib/marketing/evidence-regions'

export type EvidenceDevice = 'desktop' | 'mobile'

export interface EvidenceRect {
  x: number
  y: number
  width: number
  height: number
}

/** Flag-owned overlay target. Element targets exist only when measured. */
export interface EvidenceTarget {
  kind: 'element' | 'page'
  source: 'measured'
  device: EvidenceDevice
  rect?: EvidenceRect
  selector?: string
  text?: string
  label: string
}

export interface HarvestedNode {
  key: string
  selector?: string
  text?: string
  rect: EvidenceRect
}

export interface HarvestedEvidence {
  device: EvidenceDevice
  viewport: { width: number; height: number }
  nodes: HarvestedNode[]
}

const MAX_AXE_TARGETS = 40
const MIN_VISIBLE_PX = 8

export function baseCheckId(checkId: string | null | undefined): string {
  if (!checkId) return ''
  return checkId.split('::page:')[0] ?? checkId
}

export function isPageScopeCheck(checkId: string | null | undefined): boolean {
  const id = baseCheckId(checkId)
  return id.length > 0 && evidenceScopeForCheck(id) === 'page'
}

/** Top-left normalized rect of a viewport box. Returns null if off-screen or empty. */
export function rectFromViewport(
  box: { left: number; top: number; right: number; bottom: number },
  viewportWidth: number,
  viewportHeight: number
): EvidenceRect | null {
  if (viewportWidth <= 0 || viewportHeight <= 0) return null
  if (box.right <= box.left || box.bottom <= box.top) return null
  if (box.bottom <= 0 || box.top >= viewportHeight) return null
  if (box.right <= 0 || box.left >= viewportWidth) return null

  const widthPx = box.right - box.left
  const heightPx = box.bottom - box.top
  if (widthPx < MIN_VISIBLE_PX || heightPx < MIN_VISIBLE_PX) return null

  const padX = Math.min(widthPx * 0.08, 12)
  const padY = Math.min(heightPx * 0.12, 10)
  const left = Math.max(0, box.left - padX)
  const top = Math.max(0, box.top - padY)
  const right = Math.min(viewportWidth, box.right + padX)
  const bottom = Math.min(viewportHeight, box.bottom + padY)

  return {
    x: left / viewportWidth,
    y: top / viewportHeight,
    width: (right - left) / viewportWidth,
    height: (bottom - top) / viewportHeight,
  }
}

export function parseEvidenceTargets(value: unknown): EvidenceTarget[] {
  if (!Array.isArray(value)) return []
  const targets: EvidenceTarget[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    if (raw.source !== 'measured') continue
    if (raw.kind !== 'element' && raw.kind !== 'page') continue
    if (raw.device !== 'desktop' && raw.device !== 'mobile') continue
    const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label : 'Flagged area'
    if (raw.kind === 'page') {
      targets.push({
        kind: 'page',
        source: 'measured',
        device: raw.device,
        label,
      })
      continue
    }
    const rect = parseRect(raw.rect)
    if (!rect) continue
    const target: EvidenceTarget = {
      kind: 'element',
      source: 'measured',
      device: raw.device,
      rect,
      selector: typeof raw.selector === 'string' ? raw.selector : undefined,
      label,
    }
    const text =
      typeof raw.text === 'string' && raw.text.trim()
        ? raw.text.trim().slice(0, 160)
        : undefined
    if (text) target.text = text
    targets.push(target)
  }
  return targets
}

function parseRect(value: unknown): EvidenceRect | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const x = asUnit(raw.x)
  const y = asUnit(raw.y)
  const width = asUnit(raw.width)
  const height = asUnit(raw.height)
  if (x == null || y == null || width == null || height == null) return null
  if (width < 0.01 || height < 0.01) return null
  return { x, y, width, height }
}

function asUnit(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0 || value > 1) return null
  return value
}

export function pageEvidenceTarget(
  device: EvidenceDevice,
  checkId: string
): EvidenceTarget {
  return {
    kind: 'page',
    source: 'measured',
    device,
    label: pageScopeLabel(checkId),
  }
}

export function pageScopeLabel(checkId: string): string {
  const id = baseCheckId(checkId)
  if (/title-|description-|og-|canonical-|robots-|lang-|viewport-|favicon|structured-data|sitemap/.test(id)) {
    return 'This issue is in the page head, not a visible element'
  }
  if (/perf|unused-|console-errors|no-https|cookie-consent/.test(id)) {
    return 'This issue is page-wide, not a single element'
  }
  return 'This issue is not pinned to a visible element'
}

export async function harvestEvidenceOnPage(
  page: Page,
  device: EvidenceDevice,
  axeTargets: string[][] = []
): Promise<HarvestedEvidence | null> {
  const viewport = page.viewportSize()
  if (!viewport) return null

  const raw = await page.evaluate(
    ({ targets, vw, vh }: { targets: string[][]; vw: number; vh: number }) => {
      const visible = (el: Element) => {
        const rect = el.getBoundingClientRect()
        if (rect.width < 8 || rect.height < 8) return null
        const style = window.getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
          return null
        }
        if (rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw) return null
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        }
      }

      const nodes: Array<{
        key: string
        selector?: string
        text?: string
        box: { left: number; top: number; right: number; bottom: number }
      }> = []

      const h1 = document.querySelector('main h1, h1')
      const h1Box = h1 ? visible(h1) : null
      if (h1 && h1Box) {
        nodes.push({
          key: 'h1',
          selector: h1.id ? `#${h1.id}` : 'h1',
          text: (h1.textContent || '').trim().slice(0, 160),
          box: h1Box,
        })
      }

      const cta = document.querySelector(
        'main a[class*="cta" i], main button[type="submit"], main section:first-of-type a[href], main a.btn, main button:not(header button):not(nav button)'
      )
      const ctaBox = cta ? visible(cta) : null
      if (cta && ctaBox) {
        nodes.push({
          key: 'cta',
          selector: cta.id ? `#${cta.id}` : cta.tagName.toLowerCase(),
          text: ((cta as HTMLElement).innerText || cta.textContent || '').trim().slice(0, 160),
          box: ctaBox,
        })
      }

      const form = document.querySelector('main form, form')
      const formBox = form ? visible(form) : null
      if (form && formBox) {
        nodes.push({
          key: 'form',
          selector: form.id ? `#${form.id}` : 'form',
          text: '',
          box: formBox,
        })
      }

      const input = document.querySelector('main input, main textarea, form input, form textarea')
      const inputBox = input ? visible(input) : null
      if (input && inputBox) {
        nodes.push({
          key: 'input',
          selector: input.id ? `#${input.id}` : 'input',
          text: input.getAttribute('name') || input.getAttribute('aria-label') || '',
          box: inputBox,
        })
      }

      for (const parts of targets) {
        const selector = parts.filter(Boolean).join(' ')
        if (!selector) continue
        let el: Element | null = null
        try {
          el = document.querySelector(selector)
        } catch {
          el = null
        }
        const box = el ? visible(el) : null
        if (!el || !box) continue
        nodes.push({
          key: `axe:${selector}`,
          selector,
          text: ((el as HTMLElement).innerText || el.textContent || '').trim().slice(0, 160),
          box,
        })
      }

      return { nodes, vw, vh }
    },
    {
      targets: axeTargets
        .map((parts) => parts.map((part) => String(part)))
        .filter((parts) => parts.length > 0)
        .slice(0, MAX_AXE_TARGETS),
      vw: viewport.width,
      vh: viewport.height,
    }
  )

  const nodes: HarvestedNode[] = []
  for (const node of raw.nodes) {
    const rect = rectFromViewport(node.box, raw.vw, raw.vh)
    if (!rect) continue
    nodes.push({
      key: node.key,
      selector: node.selector,
      text: node.text,
      rect,
    })
  }

  return {
    device,
    viewport: { width: raw.vw, height: raw.vh },
    nodes,
  }
}

export function axeTargetsFromViolations(
  violations: Array<{ nodes?: Array<{ target?: string[] }> }> | null | undefined
): string[][] {
  if (!violations) return []
  const seen = new Set<string>()
  const targets: string[][] = []
  for (const violation of violations) {
    for (const node of violation.nodes ?? []) {
      const target = node.target?.filter(Boolean) ?? []
      if (target.length === 0) continue
      const key = target.join('>')
      if (seen.has(key)) continue
      seen.add(key)
      targets.push(target)
      if (targets.length >= MAX_AXE_TARGETS) return targets
    }
  }
  return targets
}

export function attachEvidenceTargets<T extends { checkId: string; evidence?: string; problem?: string; fix?: string }>(
  flags: T[],
  harvests: HarvestedEvidence[],
  extras: Array<{ checkId: string; device: EvidenceDevice; rect: EvidenceRect; selector?: string; label?: string }> = []
): Array<T & { evidenceTargets: EvidenceTarget[] }> {
  if (flags.length === 0) return flags as Array<T & { evidenceTargets: EvidenceTarget[] }>
  return flags.map((flag) => ({
    ...flag,
    evidenceTargets: targetsForFlag(flag, harvests, extras),
  }))
}

function targetsForFlag(
  flag: { checkId: string; evidence?: string; problem?: string; fix?: string },
  harvests: HarvestedEvidence[],
  extras: Array<{ checkId: string; device: EvidenceDevice; rect: EvidenceRect; selector?: string; label?: string }>
): EvidenceTarget[] {
  const checkId = baseCheckId(flag.checkId)
  if (!checkId) return []

  if (isPageScopeCheck(checkId)) {
    const devices = harvests.length > 0 ? harvests.map((h) => h.device) : (['desktop'] as EvidenceDevice[])
    return [...new Set(devices)].map((device) => pageEvidenceTarget(device, checkId))
  }

  const targets: EvidenceTarget[] = []
  const extra = extras.filter((item) => baseCheckId(item.checkId) === checkId)
  for (const item of extra) {
    targets.push({
      kind: 'element',
      source: 'measured',
      device: item.device,
      rect: item.rect,
      selector: item.selector,
      label: item.label ?? labelForCheck(checkId),
    })
  }

  for (const harvest of harvests) {
    const node = matchHarvestNode(flag, harvest)
    if (!node) continue
    if (targets.some((target) => target.device === harvest.device)) continue
    const harvested: EvidenceTarget = {
      kind: 'element',
      source: 'measured',
      device: harvest.device,
      rect: node.rect,
      selector: node.selector,
      label: labelForCheck(checkId),
    }
    const text = node.text?.trim() ? node.text.trim().slice(0, 160) : undefined
    if (text) harvested.text = text
    targets.push(harvested)
  }

  return targets
}

function matchHarvestNode(
  flag: { checkId: string; evidence?: string; problem?: string; fix?: string },
  harvest: HarvestedEvidence
): HarvestedNode | null {
  const checkId = baseCheckId(flag.checkId)
  const haystack = `${flag.problem ?? ''} ${flag.evidence ?? ''} ${flag.fix ?? ''}`.toLowerCase()

  const byKey = (key: string) => harvest.nodes.find((node) => node.key === key) ?? null

  if (/^h1-/.test(checkId) || checkId === 'axe-missing-h1') return byKey('h1')
  if (/cta|no-cta|flow-/.test(checkId)) return byKey('cta')
  if (/form|input|label/.test(checkId)) return byKey('input') ?? byKey('form')

  const quoted = [...haystack.matchAll(/"([^"]{2,160})"/g)].map((match) => match[1]?.toLowerCase() ?? '')
  for (const quote of quoted) {
    const hit = harvest.nodes.find((node) => node.text && node.text.toLowerCase().includes(quote))
    if (hit) return hit
  }

  const axeHit = harvest.nodes.find((node) => {
    if (!node.selector || !node.key.startsWith('axe:')) return false
    return haystack.includes(node.selector.toLowerCase())
  })
  if (axeHit) return axeHit

  return null
}

function labelForCheck(checkId: string): string {
  if (/^h1-/.test(checkId)) return 'Headline'
  if (/cta|no-cta|flow-/.test(checkId)) return 'Call to action'
  if (/form|input|label/.test(checkId)) return 'Form field'
  if (/image|alt/.test(checkId)) return 'Image'
  return 'Flagged element'
}

export function flowExtraFromAnchor(
  checkId: string | null,
  device: EvidenceDevice,
  anchor: { x: number; y: number; width?: number; height?: number; selector?: string } | null | undefined
): { checkId: string; device: EvidenceDevice; rect: EvidenceRect; selector?: string; label?: string } | null {
  if (!checkId || !anchor) return null
  const width = anchor.width ?? 0
  const height = anchor.height ?? 0
  if (width < 0.01 || height < 0.01) return null
  // Flow used to store center-points. Accept both: if x/y look like a center, convert.
  const looksCentered = anchor.x > width / 2 && anchor.x + width / 2 <= 1.02
  const rect: EvidenceRect = looksCentered
    ? {
        x: Math.max(0, anchor.x - width / 2),
        y: Math.max(0, anchor.y - height / 2),
        width,
        height,
      }
    : { x: anchor.x, y: anchor.y, width, height }
  return {
    checkId,
    device,
    rect,
    selector: anchor.selector,
    label: 'Call to action',
  }
}


