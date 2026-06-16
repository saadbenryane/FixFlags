/** True when pathname, query, or hash changed (SPA-friendly). */
export function urlsMeaningfullyChanged(before: string, after: string): boolean {
  try {
    const a = new URL(before)
    const b = new URL(after)
    return (
      a.pathname !== b.pathname ||
      a.search !== b.search ||
      a.hash !== b.hash
    )
  } catch {
    return before !== after
  }
}

export function serializeFlowData(result: {
  status: string
  steps: Array<{ label: string; screenshotUrl: string | null; url: string }>
  finalUrl: string
  ctaText?: string
}) {
  return {
    status: result.status,
    steps: result.steps,
    finalUrl: result.finalUrl,
    ctaText: result.ctaText ?? null,
  }
}
