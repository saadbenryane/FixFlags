export const SITE_CONNECTION_COPY = {
  states: { connected: 'Connected', not_connected: 'Not connected', mismatch: 'Mismatch',
    needs_reauth: 'Needs reauthentication', revoked: 'Revoked', unavailable: 'Unavailable' },
  settings: 'Settings', review: 'Review connection', reconnect: 'Reconnect', connect: 'Connect',
  refresh: 'Refresh context', refreshed: 'Context refreshed.', disconnect: 'Disconnect',
  lastRead: (date: string) => `Last successful read ${date}`,
  guide: (name: string) => `Read ${name} integration guide`,
  property: 'Property', unavailable: 'Connection setup is unavailable right now.',
  descriptions: { shopify: 'Store and product context', analytics: 'Audience context', search: 'Search performance context' },
  observation: (date: string | null) => date ? `Read ${date}.` : 'Observation date unknown.',
  period: (start: string | null, end: string | null) => start && end ? `from ${start} to ${end}` : 'for an unknown reporting period',
  retainedUnavailable: 'Provider unavailable; retained context.', retainedStale: 'Retained context is stale.',
} as const
