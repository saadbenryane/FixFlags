export type SiteActionAvailability = 'available' | 'sign_in' | 'claim'
export type SiteViewerActions = {
  ownership: 'owner' | 'provisional'
  check: SiteActionAvailability
  copy: SiteActionAvailability
  monitoring: SiteActionAvailability
  integrations: SiteActionAvailability
  history: SiteActionAvailability
}

/** Presentation only. Commands still independently authorize every operation. */
export function siteViewerActions(owner: boolean, authenticated = false): SiteViewerActions {
  const availability = owner ? 'available' : authenticated ? 'claim' : 'sign_in'
  return { ownership: owner ? 'owner' : 'provisional', check: availability, copy: availability,
    monitoring: availability, integrations: availability, history: availability }
}

export function siteContinuationHref(action: Exclude<SiteActionAvailability, 'available'>, destination: string): string {
  return `${action === 'claim' ? '/post-login' : '/sign-in'}?next=${encodeURIComponent(destination)}`
}
