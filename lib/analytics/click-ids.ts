/**
 * Shared definition of the first-party ad click-id cookie so the client
 * capture component and the server-side signup hook agree on shape.
 *
 * gclid = Google Ads click id, fbclid = Meta click id. Captured from the
 * landing URL on first visit and read at signup for attribution.
 */
export const CLICK_IDS_COOKIE = 'ff_click_ids'

/** 90 days, in seconds. Matches Google's default gclid attribution window. */
export const CLICK_IDS_MAX_AGE = 60 * 60 * 24 * 90

export interface ClickIds {
  gclid: string | null
  fbclid: string | null
}

export function parseClickIds(raw: string | undefined | null): ClickIds {
  if (!raw) return { gclid: null, fbclid: null }
  try {
    const parsed = JSON.parse(raw) as { gclid?: unknown; fbclid?: unknown }
    return {
      gclid: typeof parsed.gclid === 'string' ? parsed.gclid : null,
      fbclid: typeof parsed.fbclid === 'string' ? parsed.fbclid : null,
    }
  } catch (error) {
    console.warn('Failed to parse click-ids JSON', {
      raw: raw?.substring(0, 100),
      error: (error as Error).message,
    })
    return { gclid: null, fbclid: null }
  }
}

export function serializeClickIds(ids: ClickIds): string {
  return JSON.stringify({
    ...(ids.gclid ? { gclid: ids.gclid } : {}),
    ...(ids.fbclid ? { fbclid: ids.fbclid } : {}),
  })
}
