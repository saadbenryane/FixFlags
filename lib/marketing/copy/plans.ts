import { OFFER } from './brand'
import { PRICING_COPY } from './terminology'
import type { FaqEntry } from './faq'

/**
 * Marketing plan display data. Defined here (not in lib/billing/plans) so the
 * copy barrel does not pull @prisma/client into 150+ client component bundles.
 * The billing module remains the source of truth for limits, pricing logic,
 * and Stripe price IDs. Prices and review counts derive from PRICING_COPY, and
 * a parity test locks those numbers to lib/billing/plans.ts enforcement.
 */
const PRO_PRICE = PRICING_COPY.proPrice
const PRO_PERIOD = PRICING_COPY.proPeriod

function proUpgradeCta(prefix = 'Upgrade to Pro'): string {
  return `${prefix} - ${PRO_PRICE}${PRO_PERIOD}`
}

export const PLANS = [
  {
    name: 'Free',
    plan: 'FREE' as const,
    price: '$0',
    period: '',
    persona: 'One Shopify store',
    outcome: 'Know if customers can still buy',
    audits: '1 or 2 auto paths, walk every 6 hours',
    products: '1 store',
    features: [
      '1 or 2 auto purchase paths',
      'Mobile walk with video',
      'Email alerts on confirmed RED and recovery',
      'Optional Slack incoming webhook',
      '5 rechecks per day',
    ],
    cta: 'Install on Shopify',
    href: '/install',
    highlight: false,
    accountModel: 'One account for one product.',
  },
  {
    name: 'Pro',
    plan: 'BUILDER' as const,
    price: 'Waitlist',
    period: '',
    persona: 'Stores that need more than the free cap',
    outcome: 'More paths, faster walks, funnel numbers when approved',
    audits: 'Waitlist',
    products: 'More paths and stores',
    features: [
      'Extra purchase paths',
      'Faster cadence',
      'Funnel analytics when reports access is approved',
      'Longer video history',
      'Full Improve list',
    ],
    cta: 'Join Pro waitlist',
    href: '/waitlist',
    highlight: true,
    accountModel: 'One account across up to 5 products.',
  },
  {
    name: 'Studio',
    plan: 'TEAM' as const,
    price: 'Waitlist',
    period: '',
    persona: 'Agencies watching more than one store',
    outcome: 'Multiple stores on one login, later',
    audits: 'Waitlist',
    products: 'Multiple stores',
    features: [
      'Multiple stores',
      'Shared alert destination',
      'Same walk, video, and alerts as Free',
    ],
    cta: 'Join Studio waitlist',
    href: '/waitlist',
    highlight: false,
    accountModel: 'Waitlist for agencies with more than one store.',
  },
] as const

export const PRICING_FAQ: readonly FaqEntry[] = [
  {
    question: 'Is FixFlags free?',
    answer: `Yes. ${OFFER.line} Pro extras are waitlisted. We are not charging yet.`,
    learnMore: {
      href: '/help/billing-and-plans/free-vs-pro',
      label: 'Free vs Pro',
    },
  },
  {
    question: 'What does the free install include?',
    answer:
      'One or two auto purchase paths, a mobile walk with video, email on confirmed Can\'t buy and recovery, optional Slack, and five rechecks per day. Walks run about every six hours.',
    learnMore: {
      href: '/help/billing-and-plans/what-counts-as-a-check',
      label: 'What the free plan includes',
    },
  },
  {
    question: 'What is on the Pro waitlist?',
    answer:
      'Extra purchase paths, a faster cadence, funnel numbers when Shopify reports access is approved, longer video history, and the full Improve list.',
    learnMore: {
      href: '/help/billing-and-plans/upgrade-or-downgrade',
      label: 'Join the Pro waitlist',
    },
  },
  {
    question: 'Are verification videos public?',
    answer:
      'No. Video and screenshots belong to the installed store and stay in the Shopify app.',
    learnMore: { href: '/help/account/report-privacy', label: 'Alerts and proof' },
  },
  {
    question: 'Do you store screenshots and video?',
    answer:
      'Yes. We keep the last successful walk, and broken or unclear walks for 14 days. See the Privacy Policy for details.',
    learnMore: {
      href: '/help/checks-and-reports/evidence-and-screenshots',
      label: 'Watch verification',
    },
  },
  {
    question: 'What happens if I uninstall?',
    answer:
      'Walks stop. A shop redact request deletes the stored shop record and verification artifacts.',
    learnMore: {
      href: '/help/account/delete-account',
      label: 'Uninstall and data',
    },
  },
  {
    question: 'How do I recheck a path?',
    answer:
      'Open the path in the app and choose Recheck. Free stores get five manual rechecks per day. Scheduled walks continue on their own.',
    learnMore: {
      href: '/help/getting-started/flag-fix-recheck',
      label: 'Recheck a path',
    },
  },
  {
    question: 'Do you invent conversion percentages?',
    answer:
      'No. Funnel numbers appear only with real Shopify data after reports access is approved. Until then, Understand shows the steps from our last walk.',
    learnMore: {
      href: '/help/getting-started/reading-your-report',
      label: 'Understand and Improve',
    },
  },
] as const

export const PRICING = {
  label: 'Simple pricing',
  headline: 'Free on Shopify. Pro on a waitlist.',
  subhead:
    'Install and watch the purchase path. Video and email alerts are included. Paid extras are waitlisted. We are not charging yet.',
  trustBadge: 'Walk, video, and alerts on the free plan',
  assurances: [
    'One or two auto paths',
    'Walk every six hours',
    'Email plus optional Slack',
  ] as const,
  upgradeSteps: 'Create account → Stripe checkout → Dashboard',
  upgradeStepsLoggedIn: 'Stripe checkout → Dashboard',
  checkoutRedirecting: 'Redirecting to checkout…',
  allPlansInclude:
    'Every install includes the purchase-path walk, video, and email alerts. Pro extras are waitlisted.',
  pickerEyebrow: 'Pick a plan',
  pickerTitle: 'Choose how you want to start',
  pickerSubtitle:
    'Install free on Shopify. Join the Pro waitlist if you need more paths or funnel numbers.',
  pickerBody: 'Install free. Join the waitlist if you need more paths.',
  pickerBodyWithReport:
    'The first walk can start as soon as the app is installed.',
  pickerCreditNote:
    'Free includes one or two auto paths and five rechecks per day.',
  pickerReportNote: 'Choosing Free returns you to the Shopify app.',
  pickerFootnote: 'Need more detail?',
  pickerCompareLink: 'Open the full comparison.',
  pickerCurrentPlan: 'Current plan',
  pickerFreeCta: 'Start free',
  pickerProCta: 'Join Pro waitlist',
  pickerStudioCta: 'Join Studio waitlist',
  pickerRecommended: 'Recommended',
  pickerBusy: 'Working…',
} as const

export const WAITLIST_PAGE = {
  eyebrow: 'Paid plan waitlist',
  headline: 'First 500 get 25% off for 12 months',
  subhead:
    'Pro and Studio open in order. The first 500 waitlisters per plan get 25% off for 12 months from launch. The next 500 get 15% off.',
  planProLabel: 'Pro',
  planStudioLabel: 'Studio',
  planProDetail: '30 reviews each month across up to 5 products',
  planStudioDetail:
    '90 reviews, unlimited products, scheduling, and workspace access',
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
    submitPro: 'Join Pro waitlist',
    submitStudio: 'Join Studio waitlist',
    submitting: 'Joining waitlist…',
    failed: 'Could not join the waitlist. Try again.',
    success: "You're on the list. We'll email you when checkout opens.",
    description:
      'Sign up required. The first 500 waitlisters per plan get 25% off for 12 months from launch. The next 500 get 15% off.',
    gatedProCta: 'Join Pro waitlist',
    gatedStudioCta: 'Join Studio waitlist',
    gatedHint:
      'First 500 get 25% off for 12 months from launch. Next 500 get 15% off.',
  },
  waitlist: {
    submitPro: 'Join Pro waitlist',
    submitStudio: 'Join Studio waitlist',
    submitting: 'Joining waitlist…',
    failed: 'Could not join the waitlist. Try again.',
    success: "You're on the list. We'll email you when checkout opens.",
    description:
      'Sign up required. The first 500 waitlisters per plan get 25% off for 12 months from launch. The next 500 get 15% off.',
  },
  tierOffers: {
    name: 'Launch discount tiers',
    tier1Label: 'First 500: 25% off',
    tier2Label: 'Next 500: 15% off',
    duration: '12 months from launch',
    pricingCallout:
      'Pro extras are waitlisted. We are not charging yet.',
  },
} as const

export const UPSELLS = {
  anon: {
    headline: 'Save this report and run more reviews',
    body: 'Create a free account to save this report and unlock its fix prompts. Free includes three product reviews every month for one product.',
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
  atLimit: 'Product review limit reached. Upgrade to continue',
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You\u2019ve used your free product reviews',
    body: 'Join the Pro waitlist for 30 monthly reviews across up to five products.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) => {
      void scoreDelta
      return 'Update review complete'
    },
    body: 'Keep reviewing every release with more product reviews each month.',
    cta: proUpgradeCta('Join Pro waitlist'),
    plan: 'BUILDER' as const,
  },
  compare_flat: {
    headline: 'Still Flags after your update review',
    body: 'Use the full report to close what remains, then run an update review on the live URL.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  export_locked: {
    headline: 'Need more review capacity?',
    body: 'Proof exports are included on every plan. Upgrade only when you need more reviews each month.',
    cta: 'See usage plans',
    plan: 'BUILDER' as const,
  },
  free_default: {
    headline: 'Shipping more products?',
    body: 'Pro gives you 30 product reviews per month across up to five products, with history across releases.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Keep reviewing every release',
    body: 'Pro gives you more monthly reviews, more products, and release history.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
} as const

export const USAGE_METER_COPY = {
  regionLabel: 'Product review usage',
  compactLabel: 'Product reviews',
  panelLabel: 'Product reviews',
  usedOfLimit: (used: number, limit: number) => `${used} of ${limit}`,
  usedCaption: 'used this month',
  remainingCaption: (n: number) =>
    n === 1 ? '1 remaining this month' : `${n} remaining this month`,
  remainingShort: (n: number) => `${n} remaining`,
  usedThisMonthCaption: (n: number) =>
    `product review${n === 1 ? '' : 's'} used this month`,
  panelNote:
    'Each update review uses 1 product review from your monthly allowance.',
  progressLabel: (used: number, limit: number) =>
    `${used} of ${limit} product reviews used`,
  pending: (n: number) => `${n} in progress`,
  purchasedCredits: (n: number) =>
    `${n} purchased credit${n === 1 ? '' : 's'} available`,
  upgradeToPro: 'Upgrade to Pro',
  upgradeForMore: 'upgrade for more',
  paidLimitReached: 'Plan limit reached. Upgrade for more product reviews.',
  limitReached: 'Product review limit reached.',
} as const

export const BILLING_PAGE_COPY = {
  title: 'Billing',
  description: 'Manage your plan and subscription',
  pastDueTitle: 'Payment past due: features paused',
  pastDueBody:
    "Update your card to restore your paid monthly usage allowance. We'll retry automatically. Product reviews resume when payment succeeds.",
  planName: (name: string) => `${name} plan`,
  pastDuePlanName: (name: string) => `${name} (payment past due: features paused)`,
  paidFeaturesPaused: ' (paid features paused)',
  upgradeCta: 'Upgrade plan',
  changePlanCta: 'Change plan',
  compareStudio: 'Compare Studio',
  activating: 'Activating subscription…',
  activatingHint: 'This usually takes a few seconds after checkout.',
  periodEnds: (date: string) => `Current period ends ${date}`,
  paymentIssueTitle: 'Payment issue',
  canceledBody: 'Your subscription has been canceled. Features may be downgraded.',
  unpaidBody: 'Your subscription is unpaid. Check your payment method.',
  plansTitle: 'Plans',
  plansDescription: 'Compare Free, Pro, and Studio. Pick a plan when you are ready.',
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
