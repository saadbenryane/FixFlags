/** Shared CTA / conversion-path link scoring for critical path and flow scan. */
export function scoreCtaLink(href: string, text: string): number {
  const combined = `${href} ${text}`.toLowerCase()
  if (/pricing|plans|price/.test(combined)) return 100
  if (/signup|sign-up|register|login|get-started|start|try free|get started/.test(combined)) {
    return 90
  }
  if (/contact|demo|book/.test(combined)) return 50
  return 0
}

export function isDeadHref(href: string): boolean {
  const normalized = href.trim().toLowerCase()
  return (
    normalized === '' ||
    normalized === '#' ||
    normalized.startsWith('javascript:void') ||
    normalized === 'javascript:;'
  )
}

export function resolveSameOrigin(origin: string, href: string): string | null {
  try {
    if (href.startsWith('/')) return new URL(href, origin).toString()
    const parsed = new URL(href)
    if (parsed.origin === origin) return parsed.toString()
    return null
  } catch {
    return null
  }
}
