import type { ConfirmableOutcomeKind } from '../outcome-kinds'

type ObservedJourney = { journeyType: string; startUrl: string; steps: Array<{ url: string }> }
type OutcomeDiscoverySource = { pages: Array<{ url: string; title: string | null }>; journeyReviews: ObservedJourney[] }

export function outcomeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'outcome'
  )
}

/** Classify a journey type into a confirmable outcome kind, or return null if not verifiable. */
function classifyJourneyType(journeyType: string): ConfirmableOutcomeKind | null {
  const type = journeyType.toLowerCase()
  if (type === 'checkout' || type === 'purchase' || type === 'buy_flow') return 'CHECKOUT'
  if (type === 'login' || type === 'signin' || type === 'sign_in') return 'LOGIN'
  if (type === 'signup' || type === 'register' || type === 'sign_up' || type === 'registration') return 'SIGNUP'
  if (type === 'password_reset' || type === 'forgot_password' || type === 'reset_password' || type === 'recover_account') return 'PASSWORD_RESET'
  return null
}

/** Preserve raw observed identity while admitting only pages on this Site. */
export function discoverOutcomePages(siteUrl: string, source: OutcomeDiscoverySource) {
  const observed = new Map(source.pages.map(page => [page.url, page.title]))
  for (const journey of source.journeyReviews) {
    observed.set(journey.startUrl, observed.get(journey.startUrl) ?? null)
    for (const step of journey.steps) observed.set(step.url, observed.get(step.url) ?? null)
  }
  return [...observed].flatMap(([rawUrl, title]) => {
    const url = new URL(rawUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== new URL(siteUrl).hostname) return []
    url.hash = ''
    return [{ rawUrl, url: url.toString(), path: url.pathname, title }]
  })
}

/** A journey label can suggest a kind; it cannot confirm a purchase or create a generic Outcome. */
export function discoverJourneyOutcomes(journeys: ObservedJourney[]) {
  const classified = new Map<string, ConfirmableOutcomeKind>()
  for (const journey of journeys) {
    const kind = classifyJourneyType(journey.journeyType)
    if (kind) classified.set(journey.journeyType, kind)
  }
  return [...classified].flatMap(([journeyType, kind]) => {
    if (kind === 'CHECKOUT') return []
    const journey = journeys.find(item => item.journeyType === journeyType)
    const name = journeyType.trim().replaceAll('_', ' ')
    return journey && name ? [{ journeyType, kind, name, slug: outcomeSlug(journeyType),
      urls: [journey.startUrl, ...journey.steps.map(step => step.url)] }] : []
  })
}
