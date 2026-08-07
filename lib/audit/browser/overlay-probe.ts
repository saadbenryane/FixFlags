import type { Page } from 'playwright'

export interface OverlayBlockerInfo {
  tag: string
  id: string | null
  className: string
  role: string | null
  text: string
  zIndex: string
  /** Fraction of the target element area covered by the blocker (0..1). */
  coverageFraction?: number
  /** True when the blocker was still present after a settle wait. */
  persisted?: boolean
  /**
   * True when the covering node looks like a modal/overlay/dialog.
   * False for plain content overlap (e.g. an H2 sitting on a button center).
   */
  looksLikeOverlay?: boolean
}

/** Re-probe delay so transient loading/entrance overlays are not reported. */
export const OVERLAY_PERSIST_MS = 900

/** Coverage below this is treated as not blocking. */
export const OVERLAY_COVERAGE_SUPPRESS = 0.4

/** Coverage below this (but above suppress) is partial → lower severity. */
export const OVERLAY_COVERAGE_PARTIAL = 0.85

function blockerSignature(info: OverlayBlockerInfo): string {
  return `${info.tag}|${info.id ?? ''}|${info.className}|${info.role ?? ''}|${info.zIndex}`
}

/**
 * When a click target is covered, identify the element at the click point.
 * Returns null when the top element is the target (or a descendant).
 *
 * Requires the cover to still be present after {@link OVERLAY_PERSIST_MS} so
 * transient loading/entrance modals (false positives on slow-3G / SPA settle)
 * are not reported as blocking overlays.
 */
export async function detectOverlayAtPoint(
  page: Page,
  targetSelector: string,
  options: { persistMs?: number; requireOverlayLook?: boolean } = {}
): Promise<OverlayBlockerInfo | null> {
  const persistMs = options.persistMs ?? OVERLAY_PERSIST_MS
  const requireOverlayLook = options.requireOverlayLook ?? true

  try {
    const first = await probeCoverAtPoint(page, targetSelector, requireOverlayLook)
    if (!first) return null

    if (persistMs > 0) {
      await page.waitForTimeout(persistMs)
      const second = await probeCoverAtPoint(page, targetSelector, requireOverlayLook)
      if (!second) return null
      // Same cover must still win the center hit-test after settle.
      if (blockerSignature(first) !== blockerSignature(second)) return null
      return { ...second, persisted: true }
    }

    return { ...first, persisted: true }
  } catch {
    return null
  }
}

/**
 * Any element covering the target center (overlay or plain content).
 * Used to explain click failures when the cover is not a modal/overlay.
 * Still requires persistence so transient states are ignored.
 */
export async function detectObscuringElementAtPoint(
  page: Page,
  targetSelector: string,
  options: { persistMs?: number } = {}
): Promise<OverlayBlockerInfo | null> {
  return detectOverlayAtPoint(page, targetSelector, {
    persistMs: options.persistMs ?? OVERLAY_PERSIST_MS,
    requireOverlayLook: false,
  })
}

async function probeCoverAtPoint(
  page: Page,
  targetSelector: string,
  requireOverlayLook: boolean
): Promise<OverlayBlockerInfo | null> {
  return page.evaluate(
    ({ selector, requireOverlayLook: requireLook }) => {
      const el = document.querySelector(selector)
      if (!el || !(el instanceof HTMLElement)) return null
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return null
      const x = rect.left + rect.width / 2
      const y = rect.top + Math.min(rect.height / 2, 24)
      const top = document.elementFromPoint(x, y)
      if (!top || !(top instanceof HTMLElement)) return null
      if (el === top || el.contains(top) || top.contains(el)) return null

      const style = window.getComputedStyle(top)
      const position = style.position
      const zIndex = style.zIndex
      const looksLikeOverlay =
        position === 'fixed' ||
        position === 'sticky' ||
        position === 'absolute' ||
        (zIndex !== 'auto' && Number(zIndex) >= 10) ||
        top.getAttribute('role') === 'dialog' ||
        top.getAttribute('aria-modal') === 'true' ||
        /modal|overlay|dialog|popup|interstitial|adblock|cookie/i.test(
          `${top.id} ${top.className} ${top.getAttribute('role') || ''}`
        )

      let node: HTMLElement = top
      if (!looksLikeOverlay) {
        const parentDialog = top.closest(
          '[role="dialog"], [aria-modal="true"], .modal, .overlay'
        )
        if (parentDialog instanceof HTMLElement) {
          node = parentDialog
        } else if (requireLook) {
          return null
        }
      }

      const nodeStyle = window.getComputedStyle(node)
      const nodeRect = node.getBoundingClientRect()
      const overlapW = Math.max(
        0,
        Math.min(rect.right, nodeRect.right) - Math.max(rect.left, nodeRect.left)
      )
      const overlapH = Math.max(
        0,
        Math.min(rect.bottom, nodeRect.bottom) - Math.max(rect.top, nodeRect.top)
      )
      const targetArea = Math.max(1, rect.width * rect.height)
      const coverageFraction = Math.min(1, (overlapW * overlapH) / targetArea)

      // Loading/transition chrome should not count as a blocker even if it
      // momentarily covers the CTA center during SPA settle.
      const loadingCue = /skeleton|spinner|loading|aria-busy|progress/i.test(
        `${node.id} ${node.className} ${node.getAttribute('aria-busy') || ''}`
      )
      if (loadingCue || node.getAttribute('aria-busy') === 'true') {
        return null
      }

      const finalLooksLikeOverlay =
        looksLikeOverlay ||
        node.getAttribute('role') === 'dialog' ||
        node.getAttribute('aria-modal') === 'true' ||
        /modal|overlay|dialog|popup|interstitial|adblock|cookie/i.test(
          `${node.id} ${node.className} ${node.getAttribute('role') || ''}`
        )

      return {
        tag: node.tagName.toLowerCase(),
        id: node.id || null,
        className: typeof node.className === 'string' ? node.className.slice(0, 120) : '',
        role: node.getAttribute('role'),
        text: (node.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        zIndex: nodeStyle.zIndex,
        coverageFraction,
        looksLikeOverlay: finalLooksLikeOverlay,
      }
    },
    { selector: targetSelector, requireOverlayLook }
  )
}

export function formatOverlayEvidence(info: OverlayBlockerInfo): string {
  const parts = [
    info.tag,
    info.id ? `#${info.id}` : null,
    info.className ? `.${info.className.split(/\s+/).slice(0, 3).join('.')}` : null,
    info.role ? `role=${info.role}` : null,
    info.text ? `"${info.text}"` : null,
    info.zIndex !== 'auto' ? `z-index=${info.zIndex}` : null,
    typeof info.coverageFraction === 'number'
      ? `covers ~${Math.round(info.coverageFraction * 100)}% of target`
      : null,
  ].filter(Boolean)
  return parts.join(' ')
}

/**
 * Decide severity for an overlay-blocks-* flag from coverage + overlay look.
 * Returns null when the cover is too weak to report.
 */
export function severityForOverlayBlocker(
  overlay: OverlayBlockerInfo
): 'CRITICAL' | 'IMPORTANT' | null {
  const coverage = overlay.coverageFraction ?? 1
  if (coverage < OVERLAY_COVERAGE_SUPPRESS) return null
  if (overlay.looksLikeOverlay === false) return 'IMPORTANT'
  if (coverage < OVERLAY_COVERAGE_PARTIAL) return 'IMPORTANT'
  return 'CRITICAL'
}

/**
 * Clear open dialogs/modals left by earlier probes (form submit, nav clicks)
 * so the primary CTA click is not blocked by our own probe residue.
 * Prefer explicit close controls, then Escape. No-op when nothing is open.
 */
export async function dismissOpenDialogs(page: Page): Promise<void> {
  try {
    const open = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll(
          '[role="dialog"][data-state="open"], [role="dialog"]:not([aria-hidden="true"]), [aria-modal="true"]'
        )
      )
      return nodes.some((el) => {
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0'
        )
      })
    })
    if (!open) return

    const close = page.locator(
      '[role="dialog"][data-state="open"] button[aria-label*="close" i], [role="dialog"][data-state="open"] button[aria-label*="dismiss" i], [aria-modal="true"] button[aria-label*="close" i], [role="dialog"][data-state="open"] [data-radix-collection-item]'
    )
    if ((await close.count()) > 0) {
      await close.first().click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(200)
    }

    const stillOpen = await page.evaluate(() =>
      Boolean(
        document.querySelector(
          '[role="dialog"][data-state="open"], [aria-modal="true"]:not([aria-hidden="true"])'
        )
      )
    )
    if (stillOpen) {
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(250)
      // Second Escape for layered backdrops/dialogs.
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(200)
    }
  } catch {
    // Best-effort cleanup; CTA click path still classifies real blockers.
  }
}
