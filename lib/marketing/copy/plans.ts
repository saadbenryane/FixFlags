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
    persona: 'One product before launch',
    outcome: 'Review it, fix it, then verify the live result',
    audits: `${PRICING_COPY.freeProductReviewsPerMonth} product reviews / month`,
    products: '1 product',
    features: [
      '1 product',
      'Prioritized Flags with evidence and fix prompts',
      'Review again after changes and see what changed',
      'A public report link',
      'This page, plus every public link to see if it loads',
    ],
    cta: 'Start free',
    href: '/sign-up?from=pricing',
    highlight: false,
    accountModel: 'One account for one product.',
  },
  {
    name: 'Pro',
    plan: 'BUILDER' as const,
    price: PRO_PRICE,
    period: PRO_PERIOD,
    persona: 'Solo builders shipping weekly',
    outcome: 'Review every release and verify the fixes',
    audits: `${PRICING_COPY.proProductReviewsPerMonth} product reviews / month`,
    products: 'Up to 5 products',
    features: [
      'Up to 5 products',
      'Product history across releases',
      'Update-review outcomes: Fixed, still open, and new',
      'A public report link',
      'This page and every public page it links to',
      'Logged-in review on your computer (waitlisted)',
    ],
    cta: 'Join Pro waitlist',
    href: '/sign-up?plan=BUILDER',
    highlight: true,
    accountModel: 'One account across up to 5 products.',
  },
  {
    name: 'Studio',
    plan: 'TEAM' as const,
    price: PRICING_COPY.studioPrice,
    period: PRICING_COPY.studioPeriod,
    persona: 'Freelancers and agencies',
    outcome: 'Review more client products without redoing QA by hand',
    audits: `${PRICING_COPY.studioProductReviewsPerMonth} product reviews / month`,
    products: 'Unlimited products',
    features: [
      'Unlimited products',
      'Scheduled reviews',
      'Invite people to your workspace',
      'Unlimited workspace seats for a limited time',
      'Shared product history',
      'This page, its linked pages, and one level beyond',
      'Logged-in review on your computer (waitlisted)',
    ],
    cta: 'Join Studio waitlist',
    href: '/sign-up?plan=TEAM',
    highlight: false,
    accountModel: 'Unlimited workspace seats for a limited time.',
  },
] as const

export const PRICING_FAQ: readonly FaqEntry[] = [
  {
    question: 'Can I start free and upgrade later?',
    answer: `Yes. ${OFFER.line} Upgrade when you need more product reviews each month.`,
    learnMore: {
      href: '/help/billing-and-plans/upgrade-or-downgrade',
      label: 'Upgrade or downgrade your plan',
    },
  },
  {
    question: 'What counts as a product review?',
    answer:
      'Each time FixFlags reviews a live URL and produces a report, it uses one review from your monthly allowance. That includes reviewing a product for the first time, reviewing it again after changes, and a completed scheduled review on Studio. Failed runs that never produce a report do not count.',
    learnMore: {
      href: '/help/billing-and-plans/what-counts-as-a-check',
      label: 'What counts as a product review',
    },
  },
  {
    question: 'Can I review a product again after I change it?',
    answer:
      'Yes. Review the live product again to see what changed and what improved. Each completed review uses one review from your monthly allowance.',
    learnMore: {
      href: '/help/billing-and-plans/update-review-credits',
      label: 'How update reviews use credits',
    },
  },
  {
    question: 'Are reports public or private?',
    answer: OFFER.reportAccess,
    learnMore: { href: '/help/account/report-privacy', label: 'Report access' },
  },
  {
    question: 'Are screenshots stored?',
    answer:
      'Yes. We store screenshots and page evidence needed to show Flags and update-review outcomes. See the Privacy Policy for retention details.',
    learnMore: {
      href: '/help/checks-and-reports/evidence-and-screenshots',
      label: 'Evidence and screenshots',
    },
  },
  {
    question: 'How long are reports saved?',
    answer:
      'Reports saved to your account stay in your history while the account is active. Anonymous reports you never save may be removed after a retention window.',
    learnMore: {
      href: '/help/getting-started/anonymous-report-access',
      label: 'Anonymous vs signed-in report access',
    },
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Cancel from billing settings and keep access through the end of the current billing period.',
    learnMore: {
      href: '/help/billing-and-plans/cancel-or-manage',
      label: 'Cancel or manage billing',
    },
  },
  {
    question: 'What happens when I hit my limit?',
    answer:
      'Product reviews pause until your monthly allowance renews or you upgrade. Usage does not roll over.',
    learnMore: {
      href: '/help/billing-and-plans/when-credits-run-out',
      label: 'When product reviews run out',
    },
  },
  {
    question: 'Do I need a specific AI builder?',
    answer:
      'No. Every full report includes evidence-backed fix prompts you can paste into Lovable or the builder you already use.',
    learnMore: {
      href: '/help/getting-started/first-check',
      label: 'Run your first product review',
    },
  },
  {
    question: 'How far does a review go?',
    answer:
      'Every review fully reviews the page you paste and checks whether its public links load. Pro also reviews those linked pages. Studio reviews the next pages after that. Logged-in review on your computer is waitlisted NEXT for Pro and Studio, not shipped yet.',
    learnMore: { href: '/help/billing-and-plans/free-vs-pro', label: 'Free vs Pro' },
  },
  {
    question: 'What\u2019s included in every plan?',
    answer: `Free includes ${PRICING_COPY.freeProductReviewsPerMonth} product reviews per month for one product, on the page you paste plus a check of every public link. Pro (${PRICING_COPY.proPrice}${PRICING_COPY.proPeriod}) includes ${PRICING_COPY.proProductReviewsPerMonth} reviews across up to five products and reviews the pages that page links to. Studio (${PRICING_COPY.studioPrice}${PRICING_COPY.studioPeriod}) includes ${PRICING_COPY.studioProductReviewsPerMonth} reviews per month with unlimited products, scheduled reviews, a shared workspace, and one level beyond the linked pages.`,
    learnMore: { href: '/help/billing-and-plans/free-vs-pro', label: 'Free vs Pro' },
  },
] as const

export const PRICING = {
  label: 'Simple pricing',
  headline: 'Product Reviews that fit how you ship.',
  subhead:
    'Every Product Review gives you prioritized Flags, evidence, and fix prompts. Review again after a change to see what improved.',
  trustBadge: 'Clear Flags and fix prompts on every review',
  assurances: [
    'Message, Experience, and Reach',
    'Free includes 3 Product Reviews',
    'Start with a live URL',
  ] as const,
  upgradeSteps: 'Create account → Stripe checkout → Dashboard',
  upgradeStepsLoggedIn: 'Stripe checkout → Dashboard',
  checkoutRedirecting: 'Redirecting to checkout…',
  allPlansInclude:
    'Every review includes prioritized Flags, evidence, and fix prompts. Plans add how far a review goes, room for more products, release history, scheduled reviews, and workspace access.',
  pickerEyebrow: 'Pick a plan',
  pickerTitle: 'Choose how you want to start',
  pickerSubtitle:
    'Start with one product for free. Choose Pro for more products and release history, or Studio for scheduled reviews and a shared workspace.',
  pickerBody: 'Pick the plan that matches how often you ship.',
  pickerBodyWithReport:
    'Your review is still running. Pick a plan to keep your report and fix prompts.',
  pickerCreditNote:
    'New URLs and update reviews each use 1 product review from your monthly allowance.',
  pickerReportNote: 'Choosing Free returns you to the running report.',
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
      'First 500 waitlisters get 25% off for 12 months from launch. Next 500 get 15% off.',
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
