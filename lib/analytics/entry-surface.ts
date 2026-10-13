export const ENTRY_SURFACE_PARAM = 'ff_entry'
export type PublicEntrySurface = 'issue_page' | 'tool_page' | 'benchmark_page'
export type CampaignQuery = Record<string, string | string[] | undefined>

/** A declared internal entry surface is separate from an acquisition channel. */
export function readPublicEntrySurface(params: URLSearchParams): PublicEntrySurface | null {
  if (params.getAll(ENTRY_SURFACE_PARAM).length !== 1) return null
  const value = params.get(ENTRY_SURFACE_PARAM)
  return value === 'issue_page' || value === 'tool_page' || value === 'benchmark_page' ? value : null
}

/** Carry only existing campaign tags, never manufacture tags for internal navigation. */
export function withCampaignTags(path: string, query: CampaignQuery = {}): string {
  const tags = new URLSearchParams()
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = query[key]
    if (typeof value === 'string' && value.trim() && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)) tags.set(key, value)
  }
  return tags.size ? `${path}${path.includes('?') ? '&' : '?'}${tags}` : path
}

export function publicResearchEntryHref(surface: PublicEntrySurface, query: CampaignQuery = {}): string {
  return withCampaignTags(`/?${ENTRY_SURFACE_PARAM}=${surface}`, query)
}
