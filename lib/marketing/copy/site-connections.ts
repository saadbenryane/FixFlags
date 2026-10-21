export const SITE_CONNECTION_COPY = {
  available: 'Available', manageGithub: 'Manage GitHub connection', availabilityBody: 'GitHub is available. Other connections are coming soon until tested and validated.',
  comingSoon: 'Coming soon', comingSoonBody: 'Other connections become available after testing and validation. GitHub is available now.',
  savedConnection: 'Previously saved connection. New setup and refresh are unavailable while this integration is coming soon.',

  states: { connected: 'Connected', not_connected: 'Not connected', mismatch: 'Mismatch',
    needs_reauth: 'Needs reauthentication', revoked: 'Revoked', unavailable: 'Unavailable' },
  settings: 'Settings', review: 'Review connection', reconnect: 'Reconnect', connect: 'Connect',
  refresh: 'Refresh context', refreshed: 'Context refreshed.', disconnect: 'Disconnect',
  lastRead: (date: string) => `Last successful read ${date}`,
  guide: (name: string) => `Read ${name} integration guide`,
  guideLabel: 'Guide',
  property: 'Property', unavailable: 'Connection setup is unavailable right now.',
  changed: 'This connection changed. Try again from Integrations.',
  descriptions: { shopify: 'Store and product context', analytics: 'Audience context', search: 'Search performance context' },
  observation: (date: string | null) => date ? `Read ${date}.` : 'Observation date unknown.',
  period: (start: string | null, end: string | null) => start && end ? `from ${start} to ${end}` : 'for an unknown reporting period',
  retainedUnavailable: 'Provider unavailable; retained context.', retainedStale: 'Retained context is stale.',
  analyticsPage: (sessions: number | null, pageViews: number | null, period: string, age: string) =>
    `Analytics: this path had ${pageViews !== null ? `${pageViews} page views` : `${sessions} sessions`} ${period}. ${age}`,
  analyticsPages: (count: number, period: string, age: string) => `Analytics has traffic counts for ${count} recorded page${count === 1 ? '' : 's'} ${period}. ${age}`,
  analyticsAudience: (sessions: number | null, activeUsers: number | null, pageViews: number | null, period: string, age: string) =>
    `Analytics recorded ${sessions !== null || activeUsers !== null ? [sessions !== null ? `${sessions} sessions` : null, activeUsers !== null ? `${activeUsers} active users` : null].filter(Boolean).join(' and ') : `${pageViews} page views`} ${period}. ${age}`,
  analyticsMissingCounts: 'Analytics has no reported counts for this Site. Earlier context retains its original date.',
  analyticsAvailable: 'Analytics traffic counts are available as context.',
  searchPage: (query: string, impressions: number | null, clicks: number | null, period: string, age: string, pageScope: 'current' | 'reported' = 'current') =>
    `Search Console: "${query}" had ${[impressions !== null ? `${impressions} impressions` : null, clicks !== null ? `${clicks} clicks` : null].filter(Boolean).join(' and ')} on ${pageScope === 'current' ? 'this page' : 'a reported page'} ${period}. ${age}`,
  searchMissingCounts: 'Search Console has no reported counts for this Site. Earlier context retains its original date.',
} as const
