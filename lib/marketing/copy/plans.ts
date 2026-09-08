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
    persona: 'One website',
    outcome: 'Know what needs attention',
    audits: 'Start with a public URL',
    products: '1 Site',
    features: [
      'Checks on your live website',
      'Flags with evidence',
      'A clear next step to fix',
      'Independent verify after you publish',
      'Optional Shopify connection',
    ],
    cta: 'Check my website',
    href: '/new',
    highlight: false,
    badge: '',
    accountModel: 'One account for one Site.',
  },
  {
    name: 'Pro',
    plan: 'BUILDER' as const,
    price: 'Waitlist',
    period: '',
    persona: 'Teams that need more coverage',
    outcome: 'More Sites and faster checking when approved',
    audits: 'Waitlist',
    products: 'More Sites',
    features: [
      'More Sites',
      'Faster checking',
      'Longer evidence history',
      'Priority when paid extras open',
    ],
    cta: 'Join Pro waitlist',
    href: '/waitlist',
    highlight: true,
    badge: 'Best for more coverage',
    accountModel: 'One account across more than one Site.',
  },
  {
    name: 'Studio',
    plan: 'TEAM' as const,
    price: 'Waitlist',
    period: '',
    persona: 'Agencies watching more than one website',
    outcome: 'Multiple Sites on one login, later',
    audits: 'Waitlist',
    products: 'Multiple Sites',
    features: [
      'Multiple Sites',
      'Shared workspace later',
      'Same Flags, evidence, and verify as Free',
    ],
    cta: 'Join Studio waitlist',
    href: '/waitlist',
    highlight: false,
    badge: '',
    accountModel: 'Waitlist for agencies with more than one Site.',
  },
] as const

const FREE = PLANS[0]
const PRO = PLANS[1]
const STUDIO = PLANS[2]

export const PRICING_COMPARISON = {
  includedLabel: 'What is included',
  rows: [
    {
      feature: 'Who it is for',
      free: FREE.persona,
      pro: PRO.persona,
      studio: STUDIO.persona,
    },
    {
      feature: 'Coverage',
      free: 'One public website',
      pro: 'More Sites on the waitlist',
      studio: 'Multiple Sites on the waitlist',
    },
    {
      feature: 'Checking',
      free: 'Live website checks',
      pro: 'Faster checking on the waitlist',
      studio: 'Same checking as Free until extras open',
    },
    {
      feature: 'Evidence',
      free: 'Flags with captures and a next step',
      pro: 'Longer evidence history on the waitlist',
      studio: 'Same evidence as Free',
    },
    {
      feature: 'Verify',
      free: 'Fresh check after you publish',
      pro: 'Higher verify capacity on the waitlist',
      studio: 'Same verify as Free until extras open',
    },
    {
      feature: 'Shopify',
      free: 'Optional connection',
      pro: 'Richer store context when approved',
      studio: 'Multiple stores later',
    },
  ],
} as const

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
    question: 'What does free include?',
    answer:
      'A Site check on a public URL, Flags with evidence, a clear next step to fix, and an independent verify after you publish. Shopify is an optional connection, not the only way to start.',
    learnMore: {
      href: '/help/billing-and-plans/what-counts-as-a-check',
      label: 'What the free plan includes',
    },
  },
  {
    question: 'What is on the Pro waitlist?',
    answer:
      'More Sites, faster checking, and longer evidence history. We will email you when those extras open. We are not charging yet.',
    learnMore: {
      href: '/help/billing-and-plans/upgrade-or-downgrade',
      label: 'Join the Pro waitlist',
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
  label: 'Simple pricing',
  headline: 'Start free with your website. Pro is waitlisted.',
  subhead:
    'Enter a URL. See what needs attention. Paid extras are waitlisted. We are not charging yet.',
  trustBadge: 'Flags, evidence, and a clear next step',
  assurances: [
    'Live website checks',
    'Evidence with every Flag',
    'Not charging yet',
  ] as const,
  shopifyNote: 'Running Shopify?',
  shopifyCta: 'Connect Shopify',
  shopifyHref: '/install',
  compareTitle: 'Compare plans',
  faqTitle: 'Pricing questions',
  upgradeSteps: 'Create account → Stripe checkout → Dashboard',
  upgradeStepsLoggedIn: 'Stripe checkout → Dashboard',
  checkoutRedirecting: 'Redirecting to checkout…',
  allPlansInclude:
    'Every start includes a Site check, Flags, and evidence. Pro extras are waitlisted.',
  pickerEyebrow: 'Pick a plan',
  pickerTitle: 'Choose how you want to start',
  pickerSubtitle:
    'Start free with a website URL. Join the Pro waitlist if you need more Sites or faster checking.',
  pickerBody: 'Start free. Join the waitlist if you need more coverage.',
  pickerBodyWithReport:
    'The first check can start as soon as you enter a URL.',
  pickerCreditNote:
    'Free starts with one public website. Pro extras are waitlisted.',
  pickerReportNote: 'Choosing Free returns you to your Site.',
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
  planProDetail: 'More Sites and faster checking when Pro opens',
  planStudioDetail:
    'Multiple Sites on one login when Studio opens',
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
