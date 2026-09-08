export const FOCUS_DISCOVERY_PATHS = ['/', '/pricing', '/partners'] as const

export type FocusDiscoveryPath = (typeof FOCUS_DISCOVERY_PATHS)[number]

export type GscDimensionRow = {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscPageQueryRecord = {
  page: string
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export function pageUrlPath(page: string): string {
  try {
    const { pathname } = new URL(page)
    if (!pathname || pathname === '/') return '/'
    return pathname.replace(/\/+$/, '') || '/'
  } catch {
    return page
  }
}

export function isFocusDiscoveryUrl(page: string): boolean {
  return (FOCUS_DISCOVERY_PATHS as readonly string[]).includes(pageUrlPath(page))
}

export function toPageQueryRecord(row: GscDimensionRow): GscPageQueryRecord {
  return {
    page: row.keys[0] ?? '',
    query: row.keys[1] ?? '',
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }
}

export function focusPageQueryRows(
  rows: readonly GscPageQueryRecord[],
): GscPageQueryRecord[] {
  return rows.filter((row) => isFocusDiscoveryUrl(row.page))
}
