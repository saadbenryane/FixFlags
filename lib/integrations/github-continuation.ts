const SETTINGS_PATH = '/settings/integrations'

/** Only a Site integration view can be used as the account connection's return destination. */
export function githubSiteDestination(value: string | null | undefined): string | null {
  if (!value || value.length > 512 || !/^\/sites\/[a-zA-Z0-9_-]+(?:\?|$)/.test(value)) return null
  const url = new URL(value, 'https://fixflags.invalid')
  if (url.origin !== 'https://fixflags.invalid' || !/^\/sites\/[a-zA-Z0-9_-]+$/.test(url.pathname)) return null
  if ([...url.searchParams.keys()].some(key => key !== 'view') || url.searchParams.get('view') !== 'integrations') return null
  if (url.hash && url.hash !== '#integrations') return null
  return `${url.pathname}?view=integrations${url.hash}`
}

export function githubSettingsDestination(value?: string | null): string {
  const site = githubSiteDestination(value)
  return site ? `${SETTINGS_PATH}?next=${encodeURIComponent(site)}` : SETTINGS_PATH
}

export function validGithubSettingsDestination(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1024) return null
  if (value === SETTINGS_PATH) return value
  const url = new URL(value, 'https://fixflags.invalid')
  if (url.origin !== 'https://fixflags.invalid' || url.pathname !== SETTINGS_PATH || url.hash) return null
  if ([...url.searchParams.keys()].some(key => key !== 'next')) return null
  const next = githubSiteDestination(url.searchParams.get('next'))
  return next ? githubSettingsDestination(next) : null
}

export function githubResultDestination(destination: string, key: 'error' | 'connected', value: string): string {
  const url = new URL(validGithubSettingsDestination(destination) ?? SETTINGS_PATH, 'https://fixflags.invalid')
  url.searchParams.set(key, value)
  return `${url.pathname}${url.search}`
}
