export const FAVICON_CHECK_VERSION = 2
export const FAVICON_HREF_VERSION = 1
export const FAVICON_LINK_SELECTOR = 'html > head > link:is([rel~="icon" i], [rel~="apple-touch-icon" i], [rel~="apple-touch-icon-precomposed" i])'

function parseUrl(value: string, base?: string): URL | null {
  try { return new URL(value, base) }
  catch { return null }
}

/** Check the published address. Loading and selecting an icon are separate observations. */
export function hasDeclaredFavicon(hrefs: Iterable<string | null | undefined>, baseUrl: string, pageUrl: string): boolean {
  const page = parseUrl(pageUrl)
  if (!page) return false
  page.hash = ''
  const base = /^(?:data|javascript):/i.test(baseUrl) ? pageUrl : baseUrl
  for (const href of hrefs) {
    const value = href?.trim()
    if (!value || value.startsWith('#') || /[\u0000-\u001f\u007f]/.test(value)) continue
    const target = parseUrl(value, base)
    if (!target) continue
    target.hash = ''
    if (target.protocol === 'data:' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,\S/i.test(target.href)) return true
    if (target.protocol === 'blob:' && /^https?:\/\/[^/]+\/.+/i.test(target.pathname) && target.origin !== 'null') return true
    if ((target.protocol === 'https:' || target.protocol === 'http:') &&
        !target.username && !target.password && target.href !== page.href) return true
  }
  return false
}
