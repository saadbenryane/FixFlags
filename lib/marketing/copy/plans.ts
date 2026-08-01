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
    persona: "Try before launch",
    outcome: "See everything on one page",
    audits: `${PRICING_COPY.freeProductReviewsLifetime} product reviews / month`,
    features: [
      `${PRICING_COPY.freeProductReviewsLifetime} product reviews per month with full reports and fix prompts`,
      `${PRICING_COPY.freeDeepReviewTeaserLifetime} deep review teaser per month`,
      "Upgrade anytime for more reviews",
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
    outcome: "Finish what your AI started, every week",
    audits: `${PRICING_COPY.proProductReviewsPerMonth} product reviews / month`,
    features: [
      `${PRICING_COPY.proProductReviewsPerMonth} product reviews and ${PRICING_COPY.proDeepReviewsPerMonth} deep reviews per month`,
      "Before/after comparisons",
      "MCP in supported builders",
      "Weekly product watch with regression email",
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
    persona: "Agencies and multi-site teams",
    outcome: "Finish many products, not just one",
    audits: `${PRICING_COPY.studioProductReviewsPerMonth} product reviews / month`,
    features: [
      "Everything in Pro",
      `${PRICING_COPY.studioProductReviewsPerMonth} product reviews and ${PRICING_COPY.studioDeepReviewsPerMonth} deep reviews per month`,
      "Up to 5 projects",
      "Client-ready public share links",
      "GitHub repository scans",
      "Draft Fix PRs from repository Flags (secrets auto-patch when possible)",
      "Daily product watch with regression email",
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
    answer: `Yes. ${OFFER.line} Upgrade for more product reviews, deep reviews, compare, and MCP.`,
  },
  {
    question: "What counts as a product review?",
    answer:
      "A product review is one full pass on a URL: checks, report, and fix prompts. A new URL and an update review on the same report each use one product review from your monthly allowance. Failed runs that never produce a report do not count.",
  },
  {
    question: "What is a deep review?",
    answer:
      "A deep review uses agent-level browser exploration: FixFlags navigates your journeys, maps the funnel, and records paths with scrubbable playback. It uses a separate monthly allowance from standard product reviews. See /docs/deep-review for the full comparison.",
  },
  {
    question: "Do update reviews consume credits?",
    answer:
      "Yes. An update review on a report you own uses one product review credit, the same as reviewing a new URL. Run another deep review only when you need full journey and funnel coverage again.",
  },
  {
    question: "Are reports public or private?",
    answer: `${OFFER.linkPrivacy} Studio plans can create public share links. Public site pages on FixFlags are for discovery; they are not your private report.`,
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
      "Product reviews pause until you upgrade or your billing cycle resets. Free includes 3 product reviews per month. Paid plans reset each cycle.",
  },
  {
    question: "Do I need Pro for MCP?",
    answer:
      "Yes for MCP API access. You do not need MCP to use fix prompts. Generate an API key in Settings after upgrading.",
  },
  {
    question: "What\u2019s included in every plan?",
    answer:
      "Every plan includes Flags with evidence and fix prompts after you create an account. Paid plans add more product reviews, deep reviews, before/after compare, MCP, and team features.",
  },
] as const;

export const PRICING = {
  label: "Simple pricing",
  headline: "Start free. Upgrade when you\u2019re reviewing often.",
  subhead: `${OFFER.line} Upgrade for more product reviews, deep reviews, compare, and MCP.`,
  trustBadge: "Product reviews and deep reviews on every paid plan",
  assurances: [
    "Results in under 60 seconds",
    "No credit card for Free",
    "Your reports stay private",
  ] as const,
  upgradeSteps: "Create account → Stripe checkout → Dashboard",
  upgradeStepsLoggedIn: "Stripe checkout → Dashboard",
  checkoutRedirecting: "Redirecting to checkout…",
  allPlansInclude:
    "Every product review includes evidence and rubric summaries. Fix prompts come with a free account. Pro adds compare, more reviews, deep reviews, and MCP.",
  pickerEyebrow: "Pick a plan",
  pickerTitle: "Choose how you want to start",
  pickerSubtitle: "Free includes 3 product reviews per month and every Flag. Paid adds more reviews, deep reviews, compare, and MCP.",
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
      'Paid checkout opens in batches. Waitlist members can claim the 40% Founder Discount for 12 months when checkout opens (one redemption per account).',
    gatedProCta: 'Join Pro waitlist',
    gatedStudioCta: 'Join Studio waitlist',
    gatedHint: 'Pro and Studio open in batches. Join the waitlist for the 40% Founder Discount.',
  },
  waitlist: {
    submitPro: 'Join Pro waitlist',
    submitStudio: 'Join Studio waitlist',
    submitting: 'Joining waitlist…',
    failed: 'Could not join the waitlist. Try again.',
    success: "You're on the list. We'll email you when checkout opens.",
    description:
      'Paid checkout opens in batches. Waitlist members can claim the 40% Founder Discount for 12 months when checkout opens (one redemption per account).',
  },
  founderOffer: {
    name: '40% Founder Discount',
    duration: '12 months',
    pricingCallout: '40% Founder Discount for 12 months when paid checkout opens.',
  },
} as const;

export const UPSELLS = {
  anon: {
    headline: "Save this report and run more reviews",
    body: "Create a free account for fix prompts, update reviews after fixes, and 3 product reviews (lifetime). Your report saves to your history.",
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
    headline: "You\u2019ve used your free product reviews this month",
    body: "Upgrade to Pro for 25 product reviews and 4 deep reviews per month, before/after compare, and MCP in Cursor, Claude Code, Windsurf, Lovable, or Bolt.",
    cta: proUpgradeCta(),
    plan: "BUILDER" as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) => {
      void scoreDelta;
      return "Fixes verified";
    },
    body: "Keep the loop in your editor with MCP and more product reviews each month.",
    cta: proUpgradeCta("Start Pro"),
    plan: "BUILDER" as const,
  },
  compare_flat: {
    headline: "Still Flags after your update review",
    body: "Use MCP so your agent can close what remains without copy-pasting URLs.",
    cta: proUpgradeCta(),
    plan: "BUILDER" as const,
  },
  share_public: {
    headline: "Share reports with clients",
    body: "Studio includes public share links with OG previews and a Check My Site CTA for viewers.",
    cta: "Upgrade to Studio",
    plan: "TEAM" as const,
  },
  export_locked: {
    headline: "Proof exports are on Studio",
    body: "Studio includes client-ready summaries with rubrics and top Flags.",
    cta: "Upgrade to Studio",
    plan: "TEAM" as const,
  },
  free_default: {
    headline: "Ship weekly? Automate the loop",
    body: "Pro adds 25 product reviews and 4 deep reviews per month, before/after compare, and MCP so reviews run inside your supported builder.",
    cta: proUpgradeCta(),
    plan: "BUILDER" as const,
  },
  report_completed: {
    headline: "Automate the review loop",
    body: "Pro adds more product reviews and deep reviews each month, before/after proof, and MCP in your supported builder.",
    cta: proUpgradeCta(),
    plan: "BUILDER" as const,
  },
} as const;

export const BILLING_PAGE_COPY = {
  pastDueBody:
    "Update your card to restore paid features (compare, MCP, share). We'll retry automatically. Product reviews resume when payment succeeds.",
} as const;
