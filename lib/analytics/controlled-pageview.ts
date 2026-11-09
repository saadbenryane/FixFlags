export function usesControlledGooglePageviews(): boolean {
  return process.env.NEXT_PUBLIC_GA_PAGEVIEW_MODE === 'controlled'
}

export function isControlledGooglePath(pathname: string): boolean {
  return document.body?.dataset.gaPublicPaths?.split(' ').includes(pathname) ?? false
}

export function controlledGoogleLocation(url: URL, consented: boolean): string {
  const location = new URL(url.origin)
  location.pathname = url.pathname
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = url.searchParams.get(key)
    if (value && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value)) location.searchParams.set(key, value)
  }
  const gclid = url.searchParams.get('gclid')
  if (consented && gclid && /^[a-zA-Z0-9_-]{1,256}$/.test(gclid)) location.searchParams.set('gclid', gclid)
  return location.href
}

export function controlledGoogleReferrer(): string {
  const raw = document.referrer
  if (!URL.canParse(raw)) return ''
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
  if (url.origin !== window.location.origin) return url.origin
  if (!isControlledGooglePath(url.pathname)) return ''
  return url.origin + url.pathname
}
