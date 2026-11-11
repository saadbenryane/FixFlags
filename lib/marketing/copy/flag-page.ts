/** Flag detail page. The page and device appear once, beside the back link. */
export const FLAG_PAGE_COPY = {
  devices: { mobile: 'on a phone', phone: 'on a phone', tablet: 'on a tablet', desktop: 'on desktop' } as Record<string, string>,
  where: (page: string, device: string | null) => device ? `${page} ${device}` : page,
  pages: (count: number) => `${count} pages`,
  viewAll: (count: number) => `See all ${count} pages`,
  observed: 'What happened',
  expected: 'What should happen',
  details: 'Technical details',
  foundBy: 'Found by',
  found: 'Found',
  elements: 'Elements',
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
