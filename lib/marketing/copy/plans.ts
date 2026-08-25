import { OFFER } from "./brand";
import { PRICING_COPY } from "./terminology";

/**
 * Marketing plan display data. Defined here (not in lib/billing/plans) so the
 * copy barrel does not pull @prisma/client into 150+ client component bundles.
 * The billing module remains the source of truth for limits, pricing logic,
 * and Stripe price IDs. Prices and review counts derive from PRICING_COPY, and
 * a parity test locks those numbers to lib/billing/plans.ts enforcement.
 */
const PRO_PRICE = PRICING_COPY.proPrice;
const PRO_PERIOD = PRICING_COPY.proPeriod;

function proUpgradeCta(prefix = "Upgrade to Pro"): string {
  return `${prefix} - ${PRO_PRICE}${PRO_PERIOD}`;
}

export const PLANS = [
  {
    name: "Free",
    plan: "FREE" as const,
    price: "$0",
    period: "",
    persona: "One product before launch",
    outcome: "Review it, fix it, then verify the live result",
    audits: `${PRICING_COPY.freeProductReviewsPerMonth} product reviews / month`,
    features: [
      `${PRICING_COPY.freeProductReviewsPerMonth} product reviews per month`,
      "A complete Fix List with evidence and fix prompts",
      "Update comparisons, history, sharing, and Watch",
    ],
    cta: "Start free",
    href: "/sign-up?from=pricing",
    highlight: false,
    accountModel: "Single account. No seats or shared workspace.",
  },
  {
    name: "Pro",
    plan: "BUILDER" as const,
    price: PRO_PRICE,
    period: PRO_PERIOD,
    persona: "Solo builders shipping weekly",
    outcome: "Review every release and verify the fixes",
    audits: `${PRICING_COPY.proProductReviewsPerMonth} product reviews / month`,
    features: [
      `${PRICING_COPY.proProductReviewsPerMonth} product reviews shared by new and update reviews`,
      "A complete Fix List with evidence and fix prompts",
      "Update comparisons, history, sharing, and Watch",
    ],
    cta: "Start Pro",
    href: "/sign-up?plan=BUILDER",
    highlight: true,
    accountModel: "Single account. No seats or shared workspace.",
  },
  {
    name: "Studio",
    plan: "TEAM" as const,
    price: PRICING_COPY.studioPrice,
    period: PRICING_COPY.studioPeriod,
    persona: "Freelancers and agencies",
    outcome: "Review more client products without redoing QA by hand",
    audits: `${PRICING_COPY.studioProductReviewsPerMonth} product reviews / month`,
    features: [
      `${PRICING_COPY.studioProductReviewsPerMonth} product reviews shared by new and update reviews`,
      "A complete Fix List with evidence and fix prompts",
      "Update comparisons, history, sharing, and Watch",
    ],
    cta: "Start Studio",
    href: "/sign-up?plan=TEAM",
    highlight: false,
    accountModel: "Single account. No seats or shared workspace.",
  },
] as const;

export const PRICING_FAQ = [
  {
    question: "Can I start free and upgrade later?",
    answer: `Yes. ${OFFER.line} Upgrade when you need more product reviews each month.`,
  },
  {
    question: "What counts as a product review?",
    answer:
      "A product review is one full pass on a URL: checks, report, and fix prompts. A new URL, an update review, and a completed scheduled Watch review each use one product review from your monthly allowance. Failed runs that never produce a report do not count.",
  },
  {
    question: "Do update reviews consume credits?",
    answer:
      "Yes. An update review on a report you own uses one product review credit, the same as reviewing a new URL. The fresh review captures the live product again and shows what changed.",
  },
  {
    question: "Are reports public or private?",
    answer: `${OFFER.linkPrivacy} You can create a protected share link on any plan. Public site pages on FixFlags are for discovery; they are not your private report.`,
  },
  {
    question: "Are screenshots stored?",
    answer:
      "Yes. We store screenshots and page evidence needed to show Flags and before/after comparisons. See the Privacy Policy for retention details.",
  },
  {
    question: "How long are reports saved?",
    answer:
      "Reports saved to your account stay in your history while the account is active. Anonymous reports you never save may be removed after a retention window.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel from billing settings and keep access through the end of the current billing period.",
  },
  {
    question: "What happens when I hit my limit?",
    answer:
      "Product reviews pause until your monthly allowance renews or you upgrade. Usage does not roll over.",
  },
  {
    question: "Do I need a specific AI builder?",
    answer:
      "No. Every full report includes evidence-backed fix prompts you can paste into Lovable or the builder you already use.",
  },
  {
    question: "What\u2019s included in every plan?",
    answer:
      "Every plan includes the same complete web product: reports, evidence, fix prompts, update comparisons, history, sharing, Canvas, Product Signals, and Watch. Plans differ only by monthly usage.",
  },
] as const;

export const PRICING = {
  label: "Simple pricing",
  headline: "One Product Review. Choose how often you need it.",
  subhead: `${OFFER.line} Free gives you a full review-fix-verify cycle. Paid plans add monthly capacity for frequent releases and client work.`,
  trustBadge: "The complete Product Review on every plan",
  assurances: [
    "Message, Experience, and Reach",
    "No credit card for Free",
    "Your reports stay private",
  ] as const,
  upgradeSteps: "Create account → Stripe checkout → Dashboard",
  upgradeStepsLoggedIn: "Stripe checkout → Dashboard",
  checkoutRedirecting: "Redirecting to checkout…",
  allPlansInclude:
    "Every plan includes the complete Product Review: the Fix List, evidence, fix prompts, update comparisons, history, sharing, and Watch. Only monthly review capacity changes.",
  pickerEyebrow: "Pick a plan",
  pickerTitle: "Choose how you want to start",
  pickerSubtitle: "Every plan includes the complete web product. Choose the monthly review allowance that matches how often you ship.",
  pickerBody: "Pick the plan that matches how often you ship.",
  pickerBodyWithReport: "Your review is still running. Pick a plan to keep your report and fix prompts.",
  pickerReportNote: "Choosing Free returns you to the running report.",
  pickerFootnote: "Need more detail?",
  pickerCompareLink: "Open the full comparison.",
  pickerCurrentPlan: "Current plan",
  pickerFreeCta: "Start free",
  pickerProCta: "Start Pro",
  pickerStudioCta: "Start Studio",
  pickerRecommended: "Recommended",
  pickerBusy: "Working…",
} as const;

export const WAITLIST_PAGE = {
  eyebrow: 'Paid plan waitlist',
  headline: 'First 500 get 25% off for 12 months',
  subhead:
    'Pro and Studio open in order. The first 500 waitlisters per plan get 25% off for 12 months from launch. The next 500 get 15% off.',
  planProLabel: 'Pro',
  planStudioLabel: 'Studio',
  planProDetail: '15 product reviews per month for frequent releases',
  planStudioDetail: '50 product reviews per month for client and multi-product work',
  emailPlaceholder: 'you@example.com',
  joinCta: 'Join the waitlist',
  signUpRequired: 'Sign up required',
  success: "You're on the list. We'll email you when checkout opens.",
  authDialogTitle: 'Sign in to join the waitlist',
  authDialogBody: 'Continue with the email you entered, or use another method.',
} as const;

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
    gatedHint: 'First 500 get 25% off for 12 months from launch. Next 500 get 15% off.',
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
} as const;

export const UPSELLS = {
  anon: {
    headline: "Save this report and run more reviews",
    body: "Create a free account to save this report and unlock its fix prompts. Free includes three product reviews every month, shared by new URLs, update reviews, and Watch.",
    primaryCta: "Create free account",
    secondaryCta: "See paid plans",
  },
  signedInAiPending: {
    headline: "Fix prompts on the way",
    body: "Evidence and fix steps are below. Enhanced prompts for your editor usually finish within a minute.",
  },
  signedInAiDegraded: {
    headline: "Fix steps are below",
    body: "AI summary did not finish for this run. You still have evidence and fix steps for every Flag below. Run an update review to retry the AI pass.",
  },
  atLimit: "Product review limit reached. Upgrade to continue",
} as const;

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: "You\u2019ve used your free product reviews",
    body: "Upgrade to Pro for 15 product reviews per month.",
    cta: proUpgradeCta(),
    plan: "BUILDER" as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) => {
      void scoreDelta;
      return "Update review complete";
    },
    body: "Keep reviewing every release with more product reviews each month.",
    cta: proUpgradeCta("Start Pro"),
    plan: "BUILDER" as const,
  },
  compare_flat: {
    headline: "Still Flags after your update review",
    body: "Use the full report to close what remains, then run an update review on the live URL.",
    cta: proUpgradeCta(),
    plan: "BUILDER" as const,
  },
  share_public: {
    headline: "Need more review capacity?",
    body: "Sharing is included on every plan. Upgrade only when you need more product reviews each month.",
    cta: "See usage plans",
    plan: "BUILDER" as const,
  },
  export_locked: {
    headline: "Need more review capacity?",
    body: "Proof exports are included on every plan. Upgrade only when you need more reviews each month.",
    cta: "See usage plans",
    plan: "BUILDER" as const,
  },
  free_default: {
    headline: "Ship weekly? Automate the loop",
    body: "Pro adds 15 product reviews per month for a frequent review-and-verify rhythm.",
    cta: proUpgradeCta(),
    plan: "BUILDER" as const,
  },
  report_completed: {
    headline: "Automate the review loop",
    body: "Pro adds more product reviews each month.",
    cta: proUpgradeCta(),
    plan: "BUILDER" as const,
  },
} as const;

export const BILLING_PAGE_COPY = {
  pastDueBody:
    "Update your card to restore your paid monthly usage allowance. We'll retry automatically. Product reviews resume when payment succeeds.",
} as const;
