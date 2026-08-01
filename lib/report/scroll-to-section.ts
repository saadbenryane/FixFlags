/** Scroll a report section into view below site header + sticky toolbar. */
export function scrollToReportSection(
  id: string,
  options: { behavior?: ScrollBehavior } = {}
): void {
  if (typeof window === 'undefined') return
  const el = document.getElementById(id)
  if (!el) return

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior = options.behavior ?? (reducedMotion ? 'auto' : 'smooth')

  const root = document.documentElement
  const chromeRaw = getComputedStyle(root).getPropertyValue('--report-chrome-offset').trim()
  const chromePx = parseCssLength(chromeRaw) ?? 104

  const rect = el.getBoundingClientRect()
  const targetTop = window.scrollY + rect.top - chromePx
  const alreadyVisible =
    rect.top >= chromePx && rect.top < window.innerHeight * 0.55

  if (alreadyVisible && id === 'selected-flag-detail') {
    return
  }

  window.scrollTo({ top: Math.max(0, targetTop), behavior })
}

function parseCssLength(raw: string): number | null {
  if (!raw) return null
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return null
  if (raw.endsWith('rem')) return value * 16
  if (raw.endsWith('px')) return value
  return value
}
