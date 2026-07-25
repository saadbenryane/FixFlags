import { OFFER } from './brand'

/**
 * Marketing plan display data. Defined here (not in lib/billing/plans) so the
 * copy barrel does not pull @prisma/client into 150+ client component bundles.
 * The billing module remains the source of truth for limits, pricing logic,
 * and Stripe price IDs.
 */
const PRO_PRICE = '$29'
const PRO_PERIOD = '/mo'

function proUpgradeCta(prefix = 'Upgrade to Pro'): string {
  return `${prefix} - ${PRO_PRICE}${PRO_PERIOD}`
}

export const PLANS = [
  {
    name: 'Free',
    plan: 'FREE' as const,
    price: '$0',
    period: '',
    persona: 'Try before launch',
    outcome: 'See everything on one page',
    audits: '3 new URL checks',
    features: [
      '3 new URL checks with full reports and fix prompts',
      'Unlimited re-checks on reports you own',
      'Upgrade anytime for more new checks',
    ],
    cta: 'Start free',
    href: '/sign-up?from=pricing',
    highlight: false,
    accountModel: 'Single account. No seats or shared workspace.',
  },
  {
    name: 'Pro',
    plan: 'BUILDER' as const,
    price: PRO_PRICE,
    period: PRO_PERIOD,
    persona: 'Solo builders shipping weekly',
    outcome: 'Prove every fix, audit from your editor',
    audits: '25 / month',
    features: [
      'Before/after comparisons',
      'MCP in supported builders',
      '25 new URL checks per month',
      'Weekly product watch with regression email',
    ],
    cta: 'Start Pro',
    href: '/sign-up?plan=BUILDER',
    highlight: true,
    accountModel: 'Single account. No seats or shared workspace.',
  },
  {
    name: 'Agency',
    plan: 'TEAM' as const,
    price: '$99',
    period: '/mo',
    persona: 'Freelancers, agencies, and client-driven teams',
    outcome: 'Send polished client reports with one link',
    audits: '100 / month',
    features: [
      'Everything in Pro',
      'Client-ready public share links',
      'Up to 5 projects',
      'GitHub repository scans',
      'Draft Fix PRs from repo findings (secrets auto-patch when possible)',
      'Daily product watch with regression email',
    ],
    cta: 'Start Agency',
    href: '/sign-up?plan=TEAM',
    highlight: false,
    accountModel: 'Single account. No seats or shared workspace.',
  },
] as const

export const PRICING_FAQ = [
  {
    question: 'Can I start free and upgrade later?',
    answer: `Yes. ${OFFER.line} Free accounts include 3 new URL checks. Upgrade for more new checks, compare, and MCP.`,
  },
  {
    question: 'What counts as a scan?',
    answer:
      'A new URL check counts toward your plan limit. Re-checks on a report you own are free and unlimited. Failed scans that never produce a report do not use a credit. Paid plans can buy credit packs for extra new checks.',
  },
  {
    question: 'Is each page a separate scan?',
    answer:
      'Yes. Each new URL you submit is a separate check. Re-checking the same report does not use another credit.',
  },
  {
    question: 'Do re-checks consume credits?',
    answer:
      'No. Re-checks on reports you own are free and unlimited on every plan.',
  },
  {
    question: 'Are reports public or private?',
    answer: `${OFFER.linkPrivacy} Agency plans can create public share links. Public site pages on FixFlags are for discovery; they are not your private audit.`,
  },
  {
    question: 'Are screenshots stored?',
    answer:
      'Yes. We store screenshots and page evidence needed to show Flags and re-check diffs. See the Privacy Policy for retention details.',
  },
  {
    question: 'How long are reports saved?',
    answer:
      'Reports saved to your account stay in your history while the account is active. Anonymous reports you never save may be removed after a retention window.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Cancel from billing settings and keep access through the end of the current billing period.',
  },
  {
    question: 'What happens when I hit my check limit?',
    answer:
      'New URL checks pause until you upgrade or (on paid plans) buy a credit pack. Free accounts get 3 new URL checks total (not monthly). Paid plans reset each billing cycle. Re-checks on owned reports stay free.',
  },
  {
    question: 'What are credit packs?',
    answer:
      'Paid subscribers can buy +10, +25, or +50 extra new URL checks ($15 / $30 / $50) from Billing. Credits never expire and do not change your plan tier.',
  },
  {
    question: 'Do I need Pro for MCP?',
    answer:
      'Yes for MCP API access. You do not need MCP to use fix prompts. Generate an API key in Settings after upgrading.',
  },
  {
    question: 'What\u2019s included in every plan?',
    answer:
      'Every plan includes Flags with evidence, fix prompts after you create an account, and unlimited re-checks. Paid plans add more new checks, before/after compare, MCP, and team features.',
  },
] as const

export const PRICING = {
  headline: 'Start free. Upgrade when you\u2019re checking often.',
  subhead: `${OFFER.line} Upgrade for more new checks, before/after compare, and MCP.`,
  trustBadge: 'Unlimited re-checks on every plan',
  upgradeSteps: 'Create account → Stripe checkout → Dashboard',
  upgradeStepsLoggedIn: 'Stripe checkout → Dashboard',
  allPlansInclude:
    'Every check includes evidence and rubric summaries. Fix prompts come with a free account. Re-checks stay free. Pro adds compare, more new checks, and MCP.',
} as const

export const UPSELLS = {
  anon: {
    headline: 'Save this report and run more checks',
    body: 'Create a free account for fix prompts, re-check after fixes, and 3 new URL checks. Your teaser scan saves to your history.',
    primaryCta: 'Create free account',
    secondaryCta: 'See paid plans',
  },
  signedInAiPending: {
    headline: 'Fix prompts on the way',
    body: 'Evidence and fix steps are below. Enhanced prompts for your editor usually finish within a minute.',
  },
  signedInAiDegraded: {
    headline: 'Fix steps are below',
    body: 'AI summary did not finish for this run. You still have evidence and fix steps for every Flag below. Re-check to retry the AI pass.',
  },
  atLimit: 'New URL check limit reached. Upgrade to continue',
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You\u2019ve used your 3 new URL checks',
    body: 'Re-checks on reports you own stay free and unlimited. Upgrade to Pro for 25 new URL checks per month, before/after compare, and MCP in Cursor, Claude Code, Windsurf, Lovable, or Bolt.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) =>
      `Score improved ${scoreDelta > 0 ? `+${scoreDelta}` : ''}`.trim(),
    body: 'Keep the loop in your editor with MCP and 25 new checks each month.',
    cta: proUpgradeCta('Start Pro'),
    plan: 'BUILDER' as const,
  },
  compare_flat: {
    headline: 'Still Flags after your re-check',
    body: 'Use MCP so your agent can close what remains without copy-pasting URLs.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  share_public: {
    headline: 'Share reports with clients',
    body: 'Agency includes public share links with OG previews and a Check My Site CTA for viewers.',
    cta: 'Upgrade to Agency',
    plan: 'TEAM' as const,
  },
  export_locked: {
    headline: 'Proof exports are on Agency',
    body: 'Agency includes client-ready summaries with rubrics and top Flags.',
    cta: 'Upgrade to Agency',
    plan: 'TEAM' as const,
  },
  free_default: {
    headline: 'Ship weekly? Automate the loop',
    body: 'Pro adds 25 new checks per month, before/after compare, and MCP so checks run inside your supported builder.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Automate the report loop',
    body: 'Pro adds 25 new checks each month, before/after proof, and MCP in your supported builder.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
} as const
