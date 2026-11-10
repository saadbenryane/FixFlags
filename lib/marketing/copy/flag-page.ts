/** Flag detail page. Page and device lead under the title; the affected-page count lives once, in Scope. */
export const FLAG_PAGE_COPY = {
  devices: { mobile: 'on a phone', phone: 'on a phone', tablet: 'on a tablet', desktop: 'on desktop' } as Record<string, string>,
  where: (page: string, device: string | null) => device ? `${page} ${device}` : page,
  affectedPages: 'Affected pages',
  page: 'Page',
  viewAll: (count: number) => `View all ${count} pages`,
  pageNotRecorded: 'This Site, page not recorded',
  screen: 'Screen',
  connectedTitle: 'Connected context',
  connectedBody: 'These numbers come from an account connected to this Site. They sit beside the Flag.',
  affects: 'Affects',
  timeNotRecorded: 'Time not recorded',
  lighthouse: (version: string) => `Lighthouse ${version}`,
} as const

/** "on a phone" for a recorded device word; a raw size such as 390x844 reads "at 390x844". */
export function flagDeviceLabel(viewport: string | null | undefined): string | null {
  const value = viewport?.trim()
  if (!value) return null
  return FLAG_PAGE_COPY.devices[value.toLowerCase()] ?? `at ${value}`
}
