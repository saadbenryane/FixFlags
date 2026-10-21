export const SITE_CONTINUATION_PREFIX = 'fixflags:site-continuation:'
export const SITE_CONTINUATION_LIFETIME_MS = 30 * 60_000
export const SITE_RETURN_FOCUS = ['context', 'check', 'copy', 'monitoring', 'integrations', 'history', 'overview', 'account'] as const
export type SiteReturnFocus = typeof SITE_RETURN_FOCUS[number]
export type SiteContinuation = {
  version: 1
  destination: string
  recordedAt: number
  x: number
  y: number
  dialogTop: number | null
  focus: SiteReturnFocus
}

export function siteNavigationRoot(pathname: string): string | null {
  return pathname.match(/^\/sites\/[^/]+(?=\/|$)/)?.[0] ?? null
}

export function siteReturnFocus(value: string | undefined): SiteReturnFocus {
  return SITE_RETURN_FOCUS.find(key => key === value) ?? 'context'
}

/** Store navigation coordinates only. Evidence, credentials and form values never belong here. */
export function parseSiteContinuation(raw: string | null, current: URL, now: number): SiteContinuation | null {
  if (!raw || raw.length > 8192) return null
  try {
    const state = JSON.parse(raw) as Partial<SiteContinuation> | null
    if (!state || state.version !== 1 || typeof state.destination !== 'string') return null
    const destination = new URL(state.destination, current.origin)
    if (destination.origin !== current.origin || !siteNavigationRoot(destination.pathname) ||
      destination.href !== current.href || typeof state.recordedAt !== 'number' ||
      now < state.recordedAt || now - state.recordedAt > SITE_CONTINUATION_LIFETIME_MS) return null
    const coordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000
    if (!coordinate(state.x) || !coordinate(state.y) || (state.dialogTop !== null && !coordinate(state.dialogTop)) ||
      !SITE_RETURN_FOCUS.some(key => key === state.focus)) return null
    return state as SiteContinuation
  } catch { return null }
}
