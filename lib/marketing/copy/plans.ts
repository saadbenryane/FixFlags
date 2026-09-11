import { PRICING_COPY } from './terminology'
import type { FaqEntry } from './faq'

/**
 * Marketing plan display data. Defined here (not in lib/billing/plans) so the
 * copy barrel does not pull @prisma/client into 150+ client component bundles.
 * The billing module remains the source of truth for limits, pricing logic,
 * and Stripe price IDs. Display prices and frequencies derive from PRICING_COPY,
 * and a parity test locks those numbers to lib/billing/plans.ts display fields.
 */

function proUpgradeCta(prefix = 'Join waitlist'): string {
  return prefix
}

export const PLANS = [
  {
    name: 'Free',
    plan: 'FREE' as const,
    price: '$0',
    period: '',
    persona: 'One website',
    outcome: 'Verified weekly',
    audits: 'Verified weekly',
    products: '1 website',
    features: [
      '1 website',
      'Verified weekly',
      'Flags with evidence and a next step',
      'Verify after you publish',
      'Connections included',
    ],
    cta: 'Analyze',
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
    persona: 'Daily verification per website',
    outcome: 'Verified every day, billed per website',
    audits: 'Verified every day',
    products: 'Pay per website',
    features: [
      'Billed per website',
      'Verified every day',
      'Flags, evidence, and verify',
      'Connections included',
      'We are not charging yet',
    ],
    cta: 'Join waitlist',
    href: '/waitlist/pro',
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
    outcome: 'Same product, volume quoted',
    audits: 'Quoted',
    products: 'Many websites, quoted',
    features: [
      'Several websites, billed per website',
      'Client websites on one login',
      'Flags, evidence, and verify',
      'Connections included',
      'Volume quoted on the waitlist',
    ],
    cta: 'Join waitlist',
    href: '/waitlist/studio',
    highlight: false,
    badge: '',
    accountModel: 'Client websites on one login, billed per website.',
  },
] as const

/** Pricing page cards. Studio is a quiet line, not a third card. */
export const PRICING_CARDS = [PLANS[0], PLANS[1]] as const

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
      feature: 'Verification',
      free: 'Weekly',
      pro: 'Every day',
      studio: 'Quoted',
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
      'Yes. One website is free, verified weekly. Pro is $49 per website per month, verified every day. We are not charging yet.',
    learnMore: {
      href: '/help/billing-and-plans/free-vs-pro',
      label: 'Free vs Pro',
    },
  },
  {
    question: 'What does free include?',
    answer:
      'One website, verified weekly, Flags with evidence, a next step to fix, and verify after you publish. Connections are included.',
    learnMore: {
      href: '/help/billing-and-plans/what-counts-as-a-check',
      label: 'What the free plan includes',
    },
  },
  {
    question: 'How does paid monitoring work?',
    answer:
      'Pro is $49 per website per month, verified every day. That is one website looked after, not a ping. We are not charging yet. Join the waitlist to add websites. Studio is the same product for several websites, billed per website.',
    learnMore: {
      href: '/waitlist/pro',
      label: 'Join the waitlist',
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
      'Yes. Evidence stays attached to the check that captured it. Retention is covered in the Privacy Policy.',
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
  headline: 'Website monitoring, $49 per site.',
  subhead:
    'One website free, verified weekly. Pro is $49 per website per month, verified every day. We are not charging yet. Join the waitlist to add sites.',
  trustBadge: 'Flags, evidence, and a clear next step',
  assurances: [
    'Verified on a schedule',
    'Evidence with every Flag',
    'Not charging yet',
  ] as const,
  studioLine: 'Several websites?',
  studioCta: 'Join the Studio waitlist',
  studioHref: '/waitlist/studio',
  compareTitle: 'Compare plans',
  faqTitle: 'Pricing questions',
  upgradeSteps: 'Join the waitlist. We are not charging yet.',
  upgradeStepsLoggedIn: 'Join the waitlist. We are not charging yet.',
  checkoutRedirecting: 'Opening waitlist…',
  allPlansInclude:
    'Every plan includes Flags, evidence, verify, and connections.',
  pickerEyebrow: 'Pick a plan',
  pickerTitle: 'Choose how you want to start',
  pickerSubtitle:
    'Start free with one website, verified weekly. Join the waitlist for daily verification on more websites.',
  pickerBody: 'Start free. Join the waitlist to add websites.',
  pickerBodyWithReport:
    'The first check can start as soon as you enter a URL.',
  pickerCreditNote:
    'Free is one website, verified weekly. Paid is $49 per website, verified every day.',
  pickerReportNote: 'Choosing Free returns you to your Site.',
  pickerFootnote: 'Need more detail?',
  pickerCompareLink: 'See pricing.',
  pickerCurrentPlan: 'Current plan',
  pickerFreeCta: 'Start free',
  pickerProCta: 'Join waitlist',
  pickerStudioCta: 'Join waitlist',
  pickerRecommended: 'Recommended',
  pickerBusy: 'Working…',
} as const

export const DEMO_PAGE = {
  eyebrow: 'Request a demo',
  headline: 'Daily verification, billed per website.',
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
    'Pro is $49 per website per month, verified every day. We are not charging yet. Join this list and we will email you.',
  planProLabel: 'Pro',
  planStudioLabel: 'Studio',
  planProDetail: 'Daily verification, $49 per website, when checkout opens',
  planStudioDetail:
    'Several websites, billed per website, when checkout opens',
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
      'Paid monitoring is $49 per website per month, verified every day. We are not charging yet.',
    gatedProCta: 'Join waitlist',
    gatedStudioCta: 'Join waitlist',
    gatedHint: 'We are not charging yet. Join the waitlist to add websites.',
  },
  waitlist: {
    submitPro: 'Join Pro waitlist',
    submitStudio: 'Join Studio waitlist',
    submitting: 'Joining waitlist…',
    failed: 'Could not join the waitlist. Try again.',
    success: "You're on the list. We'll email you when checkout opens.",
    description:
      'Pro is $49 per website per month, verified every day. We are not charging yet.',
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
    body: 'Create a free account to save this Site and unlock its fix prompts. Free verifies one website weekly.',
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
  atLimit: 'Plan limit reached. Join the waitlist to continue',
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You have reached this period\u2019s limit',
    body: 'Free verifies one website weekly. Join the waitlist for daily verification on more websites.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) => {
      void scoreDelta
      return 'Update review complete'
    },
    body: 'Join the waitlist for daily verification on more websites.',
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
    body: 'Proof exports are included on every plan. Join the waitlist when you need daily verification on more websites.',
    cta: 'See plans',
    plan: 'BUILDER' as const,
  },
  free_default: {
    headline: 'Monitoring more than one website?',
    body: 'Paid monitoring is $49 per website per month, verified every day.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Keep this website monitored',
    body: 'Free verifies weekly. Join the waitlist for daily verification.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
} as const

export const USAGE_METER_COPY = {
  regionLabel: 'Websites monitored',
  compactLabel: 'Usage',
  panelLabel: 'Websites monitored',
  usedOfLimit: (used: number, limit: number) => `${used} of ${limit}`,
  usedCaption: 'used this period',
  remainingCaption: (n: number) =>
    n === 1 ? '1 remaining this period' : `${n} remaining this period`,
  remainingShort: (n: number) => `${n} remaining`,
  usedThisMonthCaption: (n: number) => `${n} used`,
  panelNote:
    'Free verifies 1 website weekly. Join the waitlist for daily verification on more websites.',
  progressLabel: (used: number, limit: number) =>
    `${used} of ${limit} used this period`,
  pending: (n: number) => `${n} in progress`,
  purchasedCredits: (n: number) =>
    `${n} purchased credit${n === 1 ? '' : 's'} available`,
  upgradeToPro: 'Join waitlist',
  upgradeForMore: 'join the waitlist',
  paidLimitReached: 'Plan limit reached. Join the waitlist for more websites.',
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
  upgradeCta: 'Join waitlist',
  changePlanCta: 'Change plan',
  compareStudio: 'Compare Studio',
  activating: 'Activating subscription…',
  activatingHint: 'This usually takes a few seconds after checkout.',
  periodEnds: (date: string) => `Current period ends ${date}`,
  paymentIssueTitle: 'Payment issue',
  canceledBody: 'Your subscription has been canceled. Features may be downgraded.',
  unpaidBody: 'Your subscription is unpaid. Check your payment method.',
  plansTitle: 'Plans',
  plansDescription: 'Compare Free, Pro, and Studio. Join the waitlist when you want daily verification.',
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
