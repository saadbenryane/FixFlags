import { OPEN_BETA_ACCESS } from '@/lib/billing/beta-policy'
import { PLANS } from './plans'

/** Supporting pages follow the pricing owner's public beta policy and display contract. */
export const PUBLIC_OFFER = {
  free: OPEN_BETA_ACCESS
    ? 'Free during open beta: all supported features on one website, with no usage limits and any supported monitoring schedule.'
    : `${PLANS[0].name}: ${PLANS[0].products}. ${PLANS[0].outcome}.`,
  pro: `Planned ${PLANS[1].name}: ${PLANS[1].price}${PLANS[1].period}. ${PLANS[1].outcome}.`,
  studio: `Planned ${PLANS[2].name}: ${PLANS[2].price}${PLANS[2].period}. ${PLANS[2].outcome}.`,
  paid: `Planned pricing: ${PLANS[1].name} ${PLANS[1].price}${PLANS[1].period}; ${PLANS[2].name} ${PLANS[2].price}${PLANS[2].period}.`,
  availability: 'New paid access remains on the waitlist. Joining does not add a website, start a subscription, or charge you.',
  usage: OPEN_BETA_ACCESS
    ? 'This is a temporary beta offer. We will tell you before the beta offer changes. See Pricing for planned paid website-check allowances. Final paid terms will be confirmed before launch.'
    : 'See Pricing for current usage allowances and monitoring intervals.',
} as const
