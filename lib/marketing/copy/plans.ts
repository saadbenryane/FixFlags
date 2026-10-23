import { OPEN_BETA_ACCESS, PLANNED_PAID_PRICING } from '@/lib/billing/beta-policy'
import type { FaqEntry } from './faq'

/** Planned offers are separate from persisted subscriber prices and allowances. */
function proUpgradeCta(prefix = 'Join waitlist') { return prefix }

export const PLANS = [
  {
    name: 'Free', plan: 'FREE' as const, price: '$0', period: '',
    persona: 'Explore the full product on one website',
    outcome: 'All features included during open beta',
    audits: 'No usage limits during beta', products: '1 website',
    features: ['1 website', 'All supported features', 'Any supported monitoring schedule', 'No usage limits during beta'],
    cta: 'Start free', href: '/sign-up', highlight: true, badge: 'Open beta',
    availability: 'Available now', priceLabel: 'During open beta',
    accountModel: 'One website. Full access during open beta.',
  },
  {
    name: 'Pro', plan: 'BUILDER' as const, ...PLANNED_PAID_PRICING.BUILDER,
    persona: 'Regular checks, on your schedule',
    outcome: `${PLANNED_PAID_PRICING.BUILDER.websiteChecks} website checks per month, scheduled or manual`, audits: `${PLANNED_PAID_PRICING.BUILDER.websiteChecks} website checks per month`, products: 'Billed per website',
    features: ['30 website checks per month', 'Uptime monitoring included separately', 'Custom automatic scheduling', 'Scheduled and manual checks share one allowance'],
    cta: 'Join Pro waitlist', href: '/waitlist/pro', highlight: false, badge: 'Coming soon',
    availability: 'Join the waitlist', priceLabel: 'Planned pricing',
    accountModel: 'Billed per website when paid plans open.',
  },
  {
    name: 'Studio', plan: 'TEAM' as const, ...PLANNED_PAID_PRICING.TEAM,
    persona: 'More checks for websites that change often',
    outcome: `${PLANNED_PAID_PRICING.TEAM.websiteChecks} website checks per month, with planned checks after published updates`, audits: `${PLANNED_PAID_PRICING.TEAM.websiteChecks} website checks per month`, products: 'Billed per website',
    features: ['90 website checks per month', 'Uptime monitoring included separately', 'Custom automatic scheduling', 'Planned checks after published updates with an integration'],
    cta: 'Join Studio waitlist', href: '/waitlist/studio', highlight: false, badge: 'Coming soon',
    availability: 'Join the waitlist', priceLabel: 'Planned pricing',
    accountModel: 'Billed per website when paid plans open.',
  },
] as const

export const PRICING_CARDS = PLANS

export const PRICING_COMPARISON = {
  caption: 'FixFlags plan comparison',
  allowanceNote: 'One allowance for scheduled and manual website checks. Uptime checks are included separately.',
  rows: [
    { id: 'checks', feature: 'Website checks',
      free: { value: 'No usage limits', note: 'During open beta', kind: 'unlimited' },
      pro: { value: `${PLANNED_PAID_PRICING.BUILDER.websiteChecks} / month`, note: 'Scheduled or manual', kind: 'allowance' },
      studio: { value: `${PLANNED_PAID_PRICING.TEAM.websiteChecks} / month`, note: 'One shared allowance', kind: 'allowance' } },
    { id: 'uptime', feature: 'Uptime monitoring',
      free: { value: 'Included', note: '', kind: 'included' },
      pro: { value: 'Included', note: 'Outside the website-check allowance', kind: 'included' },
      studio: { value: 'Included', note: 'Outside the website-check allowance', kind: 'included' } },
    { id: 'scheduling', feature: 'Automatic scheduling',
      free: { value: 'Custom', note: 'Any supported schedule during beta', kind: 'value' },
      pro: { value: 'Custom', note: 'Within your monthly allowance', kind: 'value' },
      studio: { value: 'Custom', note: 'Within your monthly allowance', kind: 'value' } },
    { id: 'updates', feature: 'Checks after published updates',
      free: { value: 'Planned', note: 'Included during beta when available', kind: 'pending' },
      pro: { value: 'Not included', note: 'Check manually or use your schedule', kind: 'excluded' },
      studio: { value: 'Planned', note: 'Requires a connected integration', kind: 'pending' } },
    { id: 'websites', feature: 'Websites',
      free: { value: '1 website', note: '', kind: 'value' },
      pro: { value: 'Per website', note: '', kind: 'value' },
      studio: { value: 'Per website', note: '', kind: 'value' } },
  ],
} as const

export const PRICING_FAQ: readonly FaqEntry[] = [
  { question: 'What do I get during open beta?', answer: 'All supported features on one website, with no usage limits and any supported monitoring schedule. Paid-plan allowances do not apply during beta. Update-triggered checks are still planned.', learnMore: { href: '/help/account-and-billing/free-and-pro', label: 'The beta offer' } },
  { question: 'What counts as a website check?', answer: 'A website check runs the FixFlags suite across your configured website coverage. It includes the checks available for your website and setup, and reports anything it could not verify. It is one website run, not a charge for each individual check inside it.', learnMore: { href: '/coverage', label: 'What FixFlags checks' } },
  { question: 'Do scheduled and manual checks share the allowance?', answer: 'Yes. The planned Pro allowance is 30 website checks per website per month. Studio includes 90. Scheduled and manual checks use the same allowance, so you choose how to use it. Both plans support custom automatic scheduling. Studio’s planned update-triggered checks use that same allowance.', learnMore: { href: '/docs/site-care', label: 'Monitoring coverage' } },
  { question: 'Does uptime use my website-check allowance?', answer: 'No. Uptime monitoring is included separately on every plan, including Free. Its checks run on the configured schedule and do not use the allowance for complete website checks.', learnMore: { href: '/coverage#uptime', label: 'Uptime coverage' } },
  { question: 'Can Studio check after a GitHub push or website update?', answer: 'This is planned and requires a supported repository or deployment integration. Checks target published changes on the live website. Each triggered website check uses the same 90-check allowance. This automation is not available yet.', learnMore: { href: '/integrations#github', label: 'Planned integrations' } },
  { question: 'What counts as one website?', answer: 'One website is one saved Site for a hostname. Pages on that hostname belong to the same Site. Separate subdomains count as separate websites; www and the main domain share one Site.', learnMore: { href: '/docs/getting-started', label: 'Getting started' } },
  { question: 'What if I need another website?', answer: 'Join the Pro or Studio waitlist. Joining records your interest and does not add a website, start a subscription, or charge you. You can keep using your existing website during beta.', learnMore: { href: '/waitlist', label: 'Join the waitlist' } },
  { question: 'What happens when beta ends?', answer: 'The full-access beta promotion is temporary. We plan to keep a useful Free plan with uptime monitoring. Paid plans add monthly website-check allowances. We’ll tell you before the beta offer changes. Paid plans require you to opt in; there is no automatic charge.', learnMore: { href: '/help/account-and-billing/free-and-pro', label: 'Free and future paid plans' } },
  { question: 'Are Pro and Studio available now?', answer: 'Both are coming soon. Planned pricing is $49 per website per month for Pro with 30 website checks, and $99 for Studio with 90. Final terms will be confirmed before paid launch. Existing waitlist discount terms still apply.', learnMore: { href: '/waitlist', label: 'Paid plan waitlist' } },
] as const

export const PRICING = {
  plansTitle: 'Plans', label: 'Open beta', headline: 'Website monitoring. Free during open beta.',
  headlineLead: 'Website monitoring.', headlineAccent: 'Free during open beta.',
  subhead: 'One website. All supported features and schedules. No usage limits during beta.',
  signupCta: 'Start free', signupHref: '/sign-up', signupNote: 'No credit card. No automatic charge.',
  trustBadge: 'Full access on one website',
  assurances: ['No credit card.', 'No automatic charge.', 'We’ll tell you before the beta offer changes.'] as const,
  studioLine: 'Need another website?', studioCta: 'Join the paid-plan waitlist', studioHref: '/waitlist',
  sharedTitle: 'Included in every check',
  sharedFeatures: ['Website checks', 'Problems and evidence', 'Fix guidance', 'Fresh checks after fixes', 'Monitoring history'] as const,
  sharedNote: 'The full suite across your configured website coverage.',
  compareTitle: 'Compare plans', compareLabel: 'Available now and coming soon',
  compareBody: 'Start free on one website. Paid plans for more websites are coming soon.',
  compareNote: 'During open beta, all supported features and schedules are free on one website, with no usage limits. Pro and Studio show the planned paid offer. Update-triggered checks require an integration and are not available yet.',
  coverageLink: 'Understand monitoring coverage', connectionsLink: 'See the supported integrations', faqTitle: 'Pricing questions',
  upgradeSteps: 'Join the waitlist. No subscription or charge.', upgradeStepsLoggedIn: 'Join the waitlist. No subscription or charge.', checkoutRedirecting: 'Opening waitlist…',
  allPlansInclude: 'All supported features are included during open beta.',
  pickerEyebrow: 'Open beta', pickerTitle: 'Start free on one website',
  pickerSubtitle: 'Explore all supported features without usage limits during beta. Paid plans are coming soon.',
  pickerBody: 'Start free. Join the waitlist if you need another website.',
  pickerBodyWithReport: 'The first check can start as soon as you enter a URL.',
  pickerCreditNote: 'One website. All features. No usage limits during open beta.',
  pickerReportNote: 'Choosing Free returns you to your Site.', pickerFootnote: 'Need more detail?', pickerCompareLink: 'See pricing.',
  pickerCurrentPlan: 'Current plan', pickerFreeCta: 'Start free', pickerProCta: 'Join Pro waitlist', pickerStudioCta: 'Join Studio waitlist', pickerRecommended: 'Available now', pickerBusy: 'Working…',
} as const

export const DEMO_PAGE = {
  eyebrow: 'Request a demo',
  headline: 'Explore FixFlags for your websites.',
  subhead:
    'Show us your website. We’ll email you to arrange a walkthrough of the checks, alerts, and fix guidance.',
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
    'Open beta is free on one website. Planned paid pricing is $49 per website per month for Pro and $99 for Studio. Join the list for updates; no subscription or charge.',
  planProLabel: 'Pro',
  planStudioLabel: 'Studio',
  planProDetail: 'Planned: $49 per website/month, 30 website checks and custom scheduling',
  planStudioDetail:
    'Planned: $99 per website/month, 90 website checks, custom scheduling, and checks after published updates with an integration',
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
    submitPro: 'Join Pro waitlist',
    submitStudio: 'Join Studio waitlist',
    submitting: 'Joining waitlist…',
    failed: 'Could not join the waitlist. Try again.',
    success: "You're on the list. We'll email you when checkout opens.",
    description:
      'Planned paid prices: Pro $49 and Studio $99 per website/month. Joining does not start a subscription or charge you.',
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
    body: 'Save your results, unlock fix prompts, and start scheduled monitoring. Free during open beta on one website.',
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
    body: 'Open beta includes all supported schedules on one website. Join the waitlist if you need another website.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) => {
      void scoreDelta
      return 'Update review complete'
    },
    body: 'Join the waitlist if you need another website.',
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
    body: 'Planned paid prices: Pro $49 and Studio $99 per website/month. Paid plans are coming soon.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Keep this website monitored',
    body: 'Choose any supported schedule during beta. Join the waitlist if you need another website.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
} as const

export const USAGE_METER_COPY = {
  // The heading stays period-free because an unlimited plan has no period, and a
  // heading that promises one would contradict the count shown beneath it. Where
  // a limit really does apply, `usedCaption` and `progressLabel` say "this
  // period", which is also what tells a customer when the meter resets.
  regionLabel: 'Checks',
  compactLabel: 'Checks',
  panelLabel: 'Checks',
  usedOfLimit: (used: number, limit: number) => `${used} of ${limit}`,
  usedCaption: 'used this period',
  remainingCaption: (n: number) =>
    n === 1 ? '1 remaining this period' : `${n} remaining this period`,
  remainingShort: (n: number) => `${n} remaining`,
  usedThisMonthCaption: (n: number) => `${n} used`,
  panelNote:
    'Watch and Verify are not counted here. Open beta includes one website with any supported schedule. Join the waitlist if you need another website.',
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
  compareStudio: 'Compare Studio',
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
