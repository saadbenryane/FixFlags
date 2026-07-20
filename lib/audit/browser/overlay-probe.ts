import type { Page } from 'playwright'

export interface OverlayBlockerInfo {
  tag: string
  id: string | null
  className: string
  role: string | null
  text: string
  zIndex: string
}

/**
 * When a click target is covered, identify the element at the click point.
 * Returns null when the top element is the target (or a descendant).
 */
export async function detectOverlayAtPoint(
  page: Page,
  targetSelector: string
): Promise<OverlayBlockerInfo | null> {
  try {
    return await page.evaluate((selector) => {
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

      if (!looksLikeOverlay) {
        // Still report if something else is clearly intercepting the CTA center.
        const parentDialog = top.closest('[role="dialog"], [aria-modal="true"], .modal, .overlay')
        if (!parentDialog) return null
        const node = parentDialog instanceof HTMLElement ? parentDialog : top
        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || null,
          className: typeof node.className === 'string' ? node.className.slice(0, 120) : '',
          role: node.getAttribute('role'),
          text: (node.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          zIndex: window.getComputedStyle(node).zIndex,
        }
      }

      return {
        tag: top.tagName.toLowerCase(),
        id: top.id || null,
        className: typeof top.className === 'string' ? top.className.slice(0, 120) : '',
        role: top.getAttribute('role'),
        text: (top.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        zIndex,
      }
    }, targetSelector)
  } catch {
    return null
  }
}

export function formatOverlayEvidence(info: OverlayBlockerInfo): string {
  const parts = [
    info.tag,
    info.id ? `#${info.id}` : null,
    info.className ? `.${info.className.split(/\s+/).slice(0, 3).join('.')}` : null,
    info.role ? `role=${info.role}` : null,
    info.text ? `"${info.text}"` : null,
    info.zIndex !== 'auto' ? `z-index=${info.zIndex}` : null,
  ].filter(Boolean)
  return parts.join(' ')
}
