import { PRICING_COPY } from './terminology'
import type { FaqEntry } from './faq'

/**
 * Marketing plan display data. Defined here (not in lib/billing/plans) so the
 * copy barrel does not pull @prisma/client into 150+ client component bundles.
 * The billing module remains the source of truth for limits, pricing logic,
 * and Stripe price IDs. Display prices and frequencies derive from PRICING_COPY,
 * and a parity test locks those numbers to lib/billing/plans.ts display fields.
 */

function proUpgradeCta(prefix = 'Request a demo'): string {
  return prefix
}

export const PLANS = [
  {
    name: 'Free',
    plan: 'FREE' as const,
    price: '$0',
    period: '',
    persona: 'One website',
    outcome: '24/7 monitoring, checked every 24 hours',
    audits: 'Every 24 hours',
    products: '1 website',
    features: [
      '1 website',
      '24/7 monitoring',
      'Checked every 24 hours',
      'Flags with evidence and a next step',
      'Verify after you publish',
      'Connections included',
    ],
    cta: 'Check my website',
    href: '/new',
    highlight: false,
    badge: '',
    accountModel: 'One account for one website.',
  },
  {
    name: 'Pro',
    plan: 'BUILDER' as const,
    price: PRICING_COPY.proPrice,
    period: PRICING_COPY.proPeriod,
    persona: 'Hourly monitoring per website',
    outcome: '24/7 monitoring, up to every hour',
    audits: 'Up to every hour',
    products: 'Pay per website',
    features: [
      '24/7 monitoring',
      'Checked up to every hour',
      'Billed per website',
      'Flags, evidence, and verify',
      'Connections included',
    ],
    cta: 'Request a demo',
    href: '/request-demo?plan=pro',
    highlight: true,
    badge: 'Per website',
    accountModel: 'One account. Pay per website.',
  },
  {
    name: 'Studio',
    plan: 'TEAM' as const,
    price: PRICING_COPY.studioPrice,
    period: PRICING_COPY.studioPeriod,
    persona: 'Several websites, billed per website',
    outcome: 'Hourly monitoring on a volume quote',
    audits: 'Up to every hour',
    products: 'Many websites, quoted',
    features: [
      'Hourly monitoring, billed per website',
      'Client websites on one login',
      'Flags, evidence, and verify',
      'Connections included',
      'Volume quoted on a demo',
    ],
    cta: 'Request a demo',
    href: '/request-demo?plan=studio',
    highlight: false,
    badge: '',
    accountModel: 'Client websites on one login, billed per website.',
  },
] as const

const PRO = PLANS[1]

export const PRICING_COMPARISON = {
  includedLabel: 'What is included',
  rows: [
    {
      feature: 'Price',
      free: '$0',
      pro: `${PRO.price} per website`,
      studio: 'Volume, per website',
    },
    {
      feature: 'Websites',
      free: '1',
      pro: 'Each website you add',
      studio: 'Many, quoted',
    },
    {
      feature: 'Frequency',
      free: 'Every 24 hours',
      pro: 'Up to every hour',
      studio: 'Up to every hour',
    },
    {
      feature: '24/7 monitoring',
      free: 'Yes',
      pro: 'Yes',
      studio: 'Yes',
    },
    {
      feature: 'Connections',
      free: 'Included',
      pro: 'Included',
      studio: 'Included',
    },
    {
      feature: 'Verify after you publish',
      free: 'Included',
      pro: 'Included',
      studio: 'Included',
    },
  ],
} as const

export const PRICING_FAQ: readonly FaqEntry[] = [
  {
    question: 'Is FixFlags free?',
    answer:
      'Yes. One website is free, with 24/7 monitoring checked every 24 hours. Paid monitoring is $49 per website per month, up to every hour. We are not charging yet.',
    learnMore: {
      href: '/help/billing-and-plans/free-vs-pro',
      label: 'Free vs Pro',
    },
  },
  {
    question: 'What does free include?',
    answer:
      'One website, 24/7 monitoring checked every 24 hours, Flags with evidence, a next step to fix, and verify after you publish. Connections are included, including Shopify.',
    learnMore: {
      href: '/help/billing-and-plans/what-counts-as-a-check',
      label: 'What the free plan includes',
    },
  },
  {
    question: 'How does paid monitoring work?',
    answer:
      'Pro is $49 per website per month, checked up to every hour. Studio is the same hourly monitoring for several websites, billed per website, quoted on a demo. We are not charging yet. Request a demo to add websites.',
    learnMore: {
      href: '/help/billing-and-plans/upgrade-or-downgrade',
      label: 'Request a demo',
    },
  },
  {
    question: 'Is evidence public?',
    answer:
      'A completed check has a canonical link. Screenshots and captures belong to that Site. We do not invent proof or show other people\'s websites as if they were yours.',
    learnMore: { href: '/help/account/report-privacy', label: 'Evidence and privacy' },
  },
  {
    question: 'Do you store screenshots?',
    answer:
      'Yes. Evidence stays attached to the check that captured it. See the Privacy Policy for how long we keep it.',
    learnMore: {
      href: '/help/checks-and-reports/evidence-and-screenshots',
      label: 'Evidence and screenshots',
    },
  },
  {
    question: 'How do I verify a fix?',
    answer:
      'Publish the change, then run a fresh check on the same behavior. Absence of the old Flag is not enough. FixFlags has to see the success state.',
    learnMore: {
      href: '/help/getting-started/flag-fix-recheck',
      label: 'Verify a fix',
    },
  },
  {
    question: 'Do you invent conversion percentages?',
    answer:
      'No. Connected store numbers appear only with real data after access is approved. Until then, FixFlags shows what the live website actually did.',
    learnMore: {
      href: '/help/getting-started/reading-your-report',
      label: 'Reading your Site',
    },
  },
] as const

export const PRICING = {
  label: 'Pricing',
  headline: '24/7 website monitoring.',
  subhead:
    'One website free, checked every 24 hours. Paid monitoring is $49 per website per month, up to every hour. We are not charging yet. Request a demo to add sites.',
  trustBadge: 'Flags, evidence, and a clear next step',
  assurances: [
    '24/7 monitoring',
    'Evidence with every Flag',
    'Not charging yet',
  ] as const,
  shopifyNote: 'Shopify is a connection. It is included.',
  shopifyCta: 'Connect Shopify',
  shopifyHref: '/install',
  compareTitle: 'Compare plans',
  faqTitle: 'Pricing questions',
  upgradeSteps: 'Request a demo. We are not charging yet.',
  upgradeStepsLoggedIn: 'Request a demo. We are not charging yet.',
  checkoutRedirecting: 'Opening demo request…',
  allPlansInclude:
    'Every plan includes 24/7 monitoring, Flags, evidence, verify, and connections.',
  pickerEyebrow: 'Pick a plan',
  pickerTitle: 'Choose how you want to start',
  pickerSubtitle:
    'Start free with one website, checked every 24 hours. Request a demo for hourly monitoring on more websites.',
  pickerBody: 'Start free. Request a demo to add websites.',
  pickerBodyWithReport:
    'The first check can start as soon as you enter a URL.',
  pickerCreditNote:
    'Free is one website, every 24 hours. Paid is $49 per website, up to every hour.',
  pickerReportNote: 'Choosing Free returns you to your Site.',
  pickerFootnote: 'Need more detail?',
  pickerCompareLink: 'Open the full comparison.',
  pickerCurrentPlan: 'Current plan',
  pickerFreeCta: 'Start free',
  pickerProCta: 'Request a demo',
  pickerStudioCta: 'Request a demo',
  pickerRecommended: 'Recommended',
  pickerBusy: 'Working…',
} as const

export const DEMO_PAGE = {
  eyebrow: 'Request a demo',
  headline: 'Hourly monitoring, billed per website.',
  subhead:
    'Tell us the website and the plan. We will email you to set a time. We are not charging yet.',
  nameLabel: 'Name',
  namePlaceholder: 'Your name',
  emailLabel: 'Work email',
  emailPlaceholder: 'you@company.com',
  websiteLabel: 'Website',
  websitePlaceholder: 'https://yoursite.com',
  planLabel: 'Plan',
  planPro: 'Pro',
  planStudio: 'Studio',
  siteCountLabel: 'How many websites?',
  siteCountPlaceholder: '5',
  noteLabel: 'Anything we should know',
  notePlaceholder: 'Optional',
  submitCta: 'Request a demo',
  submitting: 'Sending…',
  successTitle: 'Request sent',
  successBody: 'We will email you to set a time.',
  failed: 'Could not send the request. Try again.',
  anotherCta: 'Send another request',
  pricingLink: 'Back to pricing',
} as const

export const WAITLIST_PAGE = {
  eyebrow: 'Paid plan waitlist',
  headline: 'We will email you when checkout opens',
  subhead:
    'This list is for people who already joined. New paid intent goes through a demo. We are not charging yet.',
  planProLabel: 'Pro',
  planStudioLabel: 'Studio',
  planProDetail: 'Hourly monitoring, $49 per website, when checkout opens',
  planStudioDetail:
    'Hourly monitoring for several websites, billed per website, when checkout opens',
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
    submitPro: 'Request a demo',
    submitStudio: 'Request a demo',
    submitting: 'Opening demo request…',
    failed: 'Could not open the demo request. Try again.',
    success: 'Request sent. We will email you to set a time.',
    description:
      'Paid monitoring is $49 per website per month, up to every hour. We are not charging yet.',
    gatedProCta: 'Request a demo',
    gatedStudioCta: 'Request a demo',
    gatedHint: 'We are not charging yet. Request a demo to add websites.',
  },
  waitlist: {
    submitPro: 'Join Pro waitlist',
    submitStudio: 'Join Studio waitlist',
    submitting: 'Joining waitlist…',
    failed: 'Could not join the waitlist. Try again.',
    success: "You're on the list. We'll email you when checkout opens.",
    description:
      'This list is for people who already joined. New paid intent goes through a demo.',
  },
  tierOffers: {
    name: 'Launch discount tiers',
    tier1Label: 'First 500: 25% off',
    tier2Label: 'Next 500: 15% off',
    duration: '12 months from launch',
    pricingCallout:
      'Paid monitoring is billed per website. We are not charging yet.',
  },
} as const

export const UPSELLS = {
  anon: {
    headline: 'Save this Site',
    body: 'Create a free account to save this Site and unlock its fix prompts. Free monitors one website every 24 hours.',
    primaryCta: 'Create free account',
    secondaryCta: 'See paid plans',
  },
  signedInAiPending: {
    headline: 'Fix prompts on the way',
    body: 'Evidence and fix steps are below. Enhanced prompts for your editor usually finish within a minute.',
  },
  signedInAiDegraded: {
    headline: 'Fix steps are below',
    body: 'AI summary did not finish for this run. You still have evidence and fix steps for every Flag below. Run an update review to retry the AI pass.',
  },
  atLimit: 'Plan limit reached. Request a demo to continue',
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You have reached this period\u2019s limit',
    body: 'Free monitors one website every 24 hours. Request a demo for hourly monitoring on more websites.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) => {
      void scoreDelta
      return 'Update review complete'
    },
    body: 'Request a demo for hourly monitoring on more websites.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  compare_flat: {
    headline: 'Still Flags after your update review',
    body: 'Use the full report to close what remains, then verify on the live URL.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  export_locked: {
    headline: 'Need more websites monitored?',
    body: 'Proof exports are included on every plan. Request a demo when you need hourly monitoring on more websites.',
    cta: 'See plans',
    plan: 'BUILDER' as const,
  },
  free_default: {
    headline: 'Monitoring more than one website?',
    body: 'Paid monitoring is $49 per website per month, up to every hour.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Keep this website monitored',
    body: 'Free checks every 24 hours. Request a demo for hourly monitoring.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
} as const

export const USAGE_METER_COPY = {
  regionLabel: 'Websites monitored',
  compactLabel: 'Usage',
  panelLabel: 'This period',
  usedOfLimit: (used: number, limit: number) => `${used} of ${limit}`,
  usedCaption: 'used this period',
  remainingCaption: (n: number) =>
    n === 1 ? '1 remaining this period' : `${n} remaining this period`,
  remainingShort: (n: number) => `${n} remaining`,
  usedThisMonthCaption: (n: number) =>
    `${n} used this period`,
  panelNote:
    'Free monitors 1 website every 24 hours. Request a demo for hourly monitoring on more websites.',
  progressLabel: (used: number, limit: number) =>
    `${used} of ${limit} used this period`,
  pending: (n: number) => `${n} in progress`,
  purchasedCredits: (n: number) =>
    `${n} purchased credit${n === 1 ? '' : 's'} available`,
  upgradeToPro: 'Request a demo',
  upgradeForMore: 'request a demo',
  paidLimitReached: 'Plan limit reached. Request a demo for more websites.',
  limitReached: 'Plan limit reached.',
} as const

export const BILLING_PAGE_COPY = {
  title: 'Billing',
  description: 'Manage your plan and subscription',
  pastDueTitle: 'Payment past due: features paused',
  pastDueBody:
    "Update your card to restore paid monitoring. We'll retry automatically. Monitoring resumes when payment succeeds.",
  planName: (name: string) => `${name} plan`,
  pastDuePlanName: (name: string) => `${name} (payment past due: features paused)`,
  paidFeaturesPaused: ' (paid features paused)',
  upgradeCta: 'Request a demo',
  changePlanCta: 'Change plan',
  compareStudio: 'Compare Studio',
  activating: 'Activating subscription…',
  activatingHint: 'This usually takes a few seconds after checkout.',
  periodEnds: (date: string) => `Current period ends ${date}`,
  paymentIssueTitle: 'Payment issue',
  canceledBody: 'Your subscription has been canceled. Features may be downgraded.',
  unpaidBody: 'Your subscription is unpaid. Check your payment method.',
  plansTitle: 'Plans',
  plansDescription: 'Compare Free, Pro, and Studio. Request a demo when you want hourly monitoring.',
  currentPlanBadge: 'Current',
  historyTitle: 'Billing history',
  historyDescription: 'Purchases and receipts for this account.',
  historyEmpty: 'No purchases yet.',
  historyInvoicesHint:
    'Subscription invoices and PDF receipts live in the Stripe customer portal.',
  historyViewInvoices: 'Open invoices',
  historyHelpCta: 'How invoices work',
  creditsTitle: 'Credits',
  purchasedAvailable: (n: number) =>
    `${n} purchased check${n !== 1 ? 's' : ''} available`,
  creditsUnavailable:
    'Credit packs are no longer available for purchase. Existing credits remain active and never expire.',
  purchaseHistory: 'Purchase history',
  creditsLine: (credits: number, packId: string) =>
    `${credits} credits - ${packId.replace('_', ' ')}`,
  paid: 'Paid',
  pending: 'Pending',
  checkingCredits: 'Checking credit purchase status',
} as const
