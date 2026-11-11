import { OPEN_BETA_ACCESS } from '@/lib/billing/beta-policy'
import { PRICING_ADD_ONS, PRICING_TIERS, websitesLabel } from './pricing-page'

const [free, ...paidTiers] = PRICING_TIERS
const [extraWebsites, extraChecks] = PRICING_ADD_ONS.items
const tierLine = paidTiers
  .map(tier => `${tier.name} ${tier.price} a month with ${websitesLabel(tier.websites)} included`)
  .join(', ')

/** Supporting pages, Terms and Help read the pricing owner's public beta policy from here. */
export const PUBLIC_OFFER = {
  free: OPEN_BETA_ACCESS
    ? 'Free during open beta: all supported features on one website, with no usage limits and any supported monitoring schedule.'
    : `${free.name}: ${websitesLabel(free.websites)}.`,
  model: 'Paid plans are priced per account. Each plan includes a number of websites, and each additional website has its own monthly fee.',
  paid: `Planned pricing: ${tierLine}. ${extraWebsites.name} are ${extraWebsites.price} ${extraWebsites.unit}. ${extraChecks.name} are ${extraChecks.price} ${extraChecks.unit}.`,
  availability: 'Paid plans are coming soon and open by waitlist only. Joining the waitlist does not add a website, start a subscription, or charge you.',
  noCharge: 'There is no automatic charge. You pay only after you choose a paid plan and confirm payment.',
  usage: OPEN_BETA_ACCESS
    ? 'This is a temporary beta offer. We will tell you before the beta offer changes. Final paid terms will be confirmed before launch.'
    : 'See Pricing for current plans and monitoring schedules.',
} as const
