/**
 * Report sections live inside the living review pane, not the document flow,
 * so scrolling resolves the nearest scroll container first and only falls back
 * to the window (report surfaces rendered as a full page).
 */
export function scrollToReportSection(
  id: string,
  options: { behavior?: ScrollBehavior } = {}
): void {
  if (typeof window === 'undefined') return
  const el = document.getElementById(id)
  if (!el) return
  scrollIntoScrollParent(el, { ...options, skipWhenVisible: id === 'selected-flag-detail' })
}

/**
 * Bring the selected Flag detail into view. Where the pane is wide enough for
 * list and detail side by side the detail is its own scroll container, so the
 * pane must not move: the detail only rewinds to its own top.
 */
export function focusFlagDetail(
  detail: HTMLElement | null,
  heading?: HTMLElement | null
): void {
  if (typeof window === 'undefined' || !detail) return
  if (isScrollable(detail)) {
    detail.scrollTop = 0
  } else {
    scrollIntoScrollParent(detail, { skipWhenVisible: true })
  }
  heading?.focus({ preventScroll: true })
}

function scrollIntoScrollParent(
  el: HTMLElement,
  options: { behavior?: ScrollBehavior; skipWhenVisible?: boolean } = {}
): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior = options.behavior ?? (reducedMotion ? 'auto' : 'smooth')
  const parent = scrollParent(el)

  if (parent) {
    const parentRect = parent.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const offset = rect.top - parentRect.top
    const visible = offset >= 0 && offset < parentRect.height * 0.55
    if (options.skipWhenVisible && visible) return
    parent.scrollTo({ top: Math.max(0, parent.scrollTop + offset - 8), behavior })
    return
  }

  const root = document.documentElement
  const chromeRaw = getComputedStyle(root).getPropertyValue('--report-chrome-offset').trim()
  const chromePx = parseCssLength(chromeRaw) ?? 104
  const rect = el.getBoundingClientRect()
  const visible = rect.top >= chromePx && rect.top < window.innerHeight * 0.55
  if (options.skipWhenVisible && visible) return
  window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - chromePx), behavior })
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    if (isScrollable(node)) return node
    node = node.parentElement
  }
  return null
}

function isScrollable(el: HTMLElement): boolean {
  const overflowY = getComputedStyle(el).overflowY
  return overflowY === 'auto' || overflowY === 'scroll'
}

function parseCssLength(raw: string): number | null {
  if (!raw) return null
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return null
  if (raw.endsWith('rem')) return value * 16
  if (raw.endsWith('px')) return value
  return value
}
