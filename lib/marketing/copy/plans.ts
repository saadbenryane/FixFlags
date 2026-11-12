import { OPEN_BETA_ACCESS } from '@/lib/billing/beta-policy'
import { PRICING_ADD_ONS, PRICING_TIERS, websitesLabel } from './pricing-page'
import { PUBLIC_OFFER } from './public-offer'

const tier = (id: (typeof PRICING_TIERS)[number]['id']) => PRICING_TIERS.find(entry => entry.id === id)!
const extraWebsites = PRICING_ADD_ONS.items[0]
const extraWebsitesLine = `${extraWebsites.name} ${extraWebsites.price} ${extraWebsites.unit}`

/** In-app plan cards (Billing, plan picker). Paid prices and websites come from PRICING_TIERS. */
function paidPlan(id: 'pro' | 'team', plan: 'BUILDER' | 'TEAM', persona: string) {
  const source = tier(id)
  return {
    name: source.name, plan, price: source.price, period: source.period, persona,
    audits: `${websitesLabel(source.websites)} included`, products: websitesLabel(source.websites),
    features: [...source.features.slice(0, 3).map(feature => feature.label), extraWebsitesLine],
    cta: source.cta.label, href: source.cta.href, highlight: false, priceLabel: source.priceLabel,
  }
}

export const PLANS = [
  {
    name: 'Free', plan: 'FREE' as const, price: '$0', period: '',
    persona: 'Explore the full product on one website',
    audits: 'No usage limits during beta', products: '1 website',
    features: ['1 website', 'All supported features', 'Any supported monitoring schedule', 'No usage limits during beta'],
    cta: 'Start free', href: '/sign-up', highlight: true, priceLabel: 'During open beta',
  },
  paidPlan('pro', 'BUILDER', 'One website, checked daily'),
  // Internal plan TEAM (formerly Studio) displays as Team.
  paidPlan('team', 'TEAM', 'A few websites that change often'),
] as const

export const PRICING = {
  // The homepage owns the promise; pricing leads with the offer.
  plansTitle: 'Plans', label: 'Open beta', headline: 'Free during open beta.',
  headlineLead: 'Free during', headlineAccent: 'open beta.',
  subhead: 'One website. All supported features and schedules. No usage limits during beta.',
  signupCta: 'Start free', signupHref: '/sign-up', signupNote: 'No credit card. No automatic charge.',
  trustBadge: 'Full access on one website',
  assurances: ['No credit card.', 'No automatic charge.', 'We’ll tell you before the beta offer changes.'] as const,
  sharedTitle: 'Included in every check',
  sharedFeatures: ['Website checks', 'Problems explained clearly', 'Copy-and-paste fix instructions', 'Checks to confirm fixes', 'Your check history'] as const,
  sharedNote: 'See what needs attention, how to fix it, and whether the fix worked.',
  compareTitle: 'Compare plans', compareLabel: 'Available now and coming soon',
  compareBody: 'Start free on one website. Paid plans for more websites are coming soon.',
  compareNote: 'During open beta, all supported features and schedules are free on one website, with no usage limits. Pro, Team and Agency show planned pricing.',
  coverageLink: 'See what gets checked', connectionsLink: 'See optional connections', faqTitle: 'Pricing questions', faqLines: ['Pricing questions.', 'Straight answers.'] as const,
  upgradeSteps: 'Join the waitlist. No subscription or charge.', upgradeStepsLoggedIn: 'Join the waitlist. No subscription or charge.', checkoutRedirecting: 'Opening waitlist…',
  allPlansInclude: 'All supported features are included during open beta.',
  pickerEyebrow: 'Open beta', pickerTitle: 'Start free on one website',
  pickerSubtitle: 'Explore all supported features without usage limits during beta. Paid plans are coming soon.',
  pickerBody: 'Start free. Join the waitlist if you need another website.',
  pickerBodyWithReport: 'Create a free account and your first check starts right away.',
  pickerCreditNote: 'One website. All features. No usage limits during open beta.',
  pickerReportNote: 'Choosing Free returns you to your Site.', pickerFootnote: 'Need more detail?', pickerCompareLink: 'See pricing.',
  // Keys named Studio follow internal plan TEAM, which displays as Team.
  pickerCurrentPlan: 'Current plan', pickerFreeCta: 'Start free', pickerProCta: 'Join Pro waitlist', pickerStudioCta: 'Join Team waitlist', pickerRecommended: 'Available now', pickerBusy: 'Working…',
} as const

function waitlistPlan(id: 'pro' | 'team' | 'agency') {
  const source = tier(id)
  return {
    label: source.name,
    detail: `Planned: ${source.price} a month with ${websitesLabel(source.websites)} included. ${extraWebsitesLine}.`,
    submit: source.cta.label,
  }
}

export const WAITLIST_PAGE = {
  eyebrow: 'Paid plan waitlist',
  headline: 'We will email you when checkout opens',
  subhead: `Open beta is free on one website. ${PUBLIC_OFFER.model} Join the list for updates; no subscription or charge.`,
  /** One entry per waitlist address: /waitlist/pro, /waitlist/team, /waitlist/agency. */
  plans: {
    pro: waitlistPlan('pro'),
    team: waitlistPlan('team'),
    agency: waitlistPlan('agency'),
  },
  emailPlaceholder: 'you@example.com',
  joinCta: 'Join the waitlist',
  signUpRequired: 'Sign up required',
  success: "You're on the list. We'll email you when checkout opens.",
  authDialogTitle: 'Sign in to join the waitlist',
  authDialogBody: 'Continue with the email you entered, or use another method.',
} as const

export const BILLING_ACTION_COPY = {
  checkout: {
    redirecting: 'Redirecting to checkout…',
    unavailableTitle: 'Checkout is not configured yet.',
    unavailableBody: 'Manage billing from your dashboard or try again later.',
    failed: 'Could not start checkout. Try again.',
    missingDestination: 'Checkout did not return a destination.',
    existingTitle: 'You already have a subscription',
    existingBody: 'Opening the billing portal to change plans.',
  },
  beta: {
    submitPro: 'Join waitlist',
    submitStudio: 'Join waitlist',
    submitting: 'Opening waitlist…',
    failed: 'Could not open the waitlist. Try again.',
    success: "You're on the list. We'll email you when checkout opens.",
    description:
      'Open beta includes all supported features on one website. Paid plans are coming soon.',
    gatedProCta: 'Join waitlist',
    gatedStudioCta: 'Join waitlist',
    gatedHint: 'Join the waitlist if you need another website. Joining does not add a website or charge you.',
  },
  waitlist: {
    submitPro: tier('pro').cta.label,
    // Internal plan TEAM (formerly Studio) displays as Team.
    submitStudio: tier('team').cta.label,
    submitting: 'Joining waitlist…',
    failed: 'Could not join the waitlist. Try again.',
    success: "You're on the list. We'll email you when checkout opens.",
    description: `${PUBLIC_OFFER.paid} Joining does not start a subscription or charge you.`,
  },
  tierOffers: {
    name: 'Launch discount tiers',
    tier1Label: 'First 500: 25% off',
    tier2Label: 'Next 500: 15% off',
    duration: '12 months from launch',
  },
} as const

export const BILLING_PAGE_COPY = {
  title: 'Billing',
  description: 'Manage your plan and subscription',
  betaOffer: 'Full access during open beta. No usage limits on one website.',
  betaCadence: 'Any supported schedule during beta',
  cadenceLabel: 'Monitoring',
websitesLabel: 'Websites',
statusLabel: 'Billing status',
  pastDueTitle: OPEN_BETA_ACCESS ? 'Payment past due' : 'Payment past due: features paused',
  pastDueBody:
    OPEN_BETA_ACCESS ? 'Your subscription payment is past due. You can update your card in the billing portal. Open beta access remains available.' : "Update your card to restore paid monitoring. We'll retry automatically. Monitoring resumes when payment succeeds.",
  planName: (name: string) => `${name} plan`,
  pastDuePlanName: (name: string) => `${name} (${OPEN_BETA_ACCESS ? 'payment past due' : 'payment past due: features paused'})`,
  paidFeaturesPaused: OPEN_BETA_ACCESS ? ' (open beta access available)' : ' (paid features paused)',
  upgradeCta: 'Join waitlist',
  changePlanCta: 'Change plan',
  activating: 'Activating subscription…',
  activatingHint: 'This usually takes a few seconds after checkout.',
  periodEnds: (date: string) => `Current period ends ${date}`,
  paymentIssueTitle: 'Payment issue',
  canceledBody: OPEN_BETA_ACCESS ? 'Your subscription has been canceled. Open beta access remains available.' : 'Your subscription has been canceled. Features may be downgraded.',
  unpaidBody: 'Your subscription is unpaid. Check your payment method.',
  plansTitle: 'Plans',
  plansDescription: 'Explore all supported features on one website during open beta. Join the waitlist if you need another website.',
  currentPlanBadge: 'Current',
  historyTitle: 'Billing history',
  historyDescription: 'Subscription invoices and receipts for this account.',
  historyEmpty: 'No subscription invoices yet.',
  historyInvoicesHint:
    'Subscription invoices and PDF receipts live in the Stripe customer portal.',
  historyViewInvoices: 'Open invoices',
  historyHelpCta: 'How invoices work',
  state: {
    free: 'Free',
    waitlisted: 'Waitlisted',
    checkout_available: 'Checkout available',
    pending_activation: 'Pending activation',
    active: 'Active',
    past_due: 'Past due',
    canceled: 'Canceled',
  },
} as const
