/** True when origin, pathname, query, or hash changed (SPA-friendly). */
export function urlsMeaningfullyChanged(before: string, after: string): boolean {
  try {
    const a = new URL(before)
    const b = new URL(after)
    return (
      a.origin !== b.origin ||
      a.pathname !== b.pathname ||
      a.search !== b.search ||
      a.hash !== b.hash
    )
  } catch {
    return before !== after
  }
}

/** Same-page hash CTAs often scroll without updating location.href in headless Chrome. */
export function isSamePageHashHref(href: string | null | undefined): href is string {
  return typeof href === 'string' && href.startsWith('#') && href.length > 1
}

export function serializeFlowData(result: {
  status: string
  steps: Array<{ label: string; screenshotUrl: string | null; url: string }>
  finalUrl: string
  ctaText?: string
  ctaHref?: string | null
}) {
  return {
    status: result.status,
    steps: result.steps,
    finalUrl: result.finalUrl,
    ctaText: result.ctaText ?? null,
    ctaHref: result.ctaHref ?? null,
  }
}
