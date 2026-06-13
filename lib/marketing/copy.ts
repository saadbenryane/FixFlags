/**
 * QualityOS marketing copy — single source of truth.
 *
 * Voice: operator clarity (see docs/voice-and-copy.md).
 * Do: short sentences, verb-first CTAs, name tools, lead with launch outcomes.
 * Don't: comprehensive, robust, leverage, unlock, 10x; over-promise free tier.
 */

export const BRAND = {
  name: 'QualityOS',
  tagline: 'Check your site before you ship',
  category: 'Post-build QA for AI-shipped apps',
  oneLiner: 'Paste a URL. Get a grade and fix prompts.',
  tribeBadge: 'For builders using Cursor, Lovable, and Bolt',
  mechanismLine: 'Every finding ships with a fix prompt your agent can run',
} as const

/** Named once on the page — do not repeat in every section */
export const AI_TOOLS = 'Cursor, Claude, Lovable, and Bolt' as const

export const AUDIT_CATEGORIES =
  'Performance, SEO, mobile, conversion, trust, content, and accessibility' as const

export const HERO = {
  headline: 'Check your site before you ship',
  subhead:
    'Paste a URL. Get a graded report with evidence and fix prompts for your AI editor.',
  trustLine: 'Free. No account. Under 60 seconds.',
  primaryCta: 'Audit my site',
  secondaryCta: 'See sample report',
} as const

/** Friction reducers only — not product claims. Product proof lives in the sample card. */
export const HERO_PILLS = ['Free first audit', 'No account', 'Under 60 seconds'] as const

export const SAMPLE_FINDINGS = [
  { area: 'Mobile', grade: 'C', issue: 'Primary CTA below fold at 375px' },
  { area: 'SEO', grade: 'D', issue: 'og:image missing. Link previews show blank.' },
  { area: 'Performance', grade: 'B', issue: '320KB of unused JavaScript' },
] as const

export const SAMPLE_FINDINGS_FOOTER = 'Each finding includes a copy-ready fix prompt'

export const WORKFLOW_SECTION = {
  headline: 'Four steps to a launch-ready site',
} as const

export const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Paste your URL',
    body: 'Any public page: landing, pricing, portfolio',
  },
  {
    step: 2,
    title: 'Read your grades',
    body: 'Performance, SEO, mobile, conversion, trust, and more',
  },
  {
    step: 3,
    title: 'Copy a fix prompt',
    body: `Paste into ${AI_TOOLS}`,
  },
  {
    step: 4,
    title: 'Re-check after fixes',
    body: 'Before/after scores show what changed',
  },
] as const

export const PROBLEM_SECTION = {
  headline: 'Fast to ship. Easy to miss the details.',
  pains: [
    {
      title: 'Broken on mobile',
      body: 'CTA below the fold, tap targets too small, layout breaks at 375px',
    },
    {
      title: 'Broken in previews',
      body: 'Missing og:image, weak meta, blank cards when you share the link',
    },
    {
      title: 'Broken for conversion',
      body: 'Vague hero copy, weak trust signals, unclear what the page wants you to do',
    },
  ],
} as const

export const DIFFERENTIATION = {
  headline: 'Graded findings with fix prompts, not just a score',
  rows: [
    { feature: 'Says why each issue hurts launch', lighthouse: 'Partial', manual: 'Yes', qualityos: 'Yes' },
    { feature: 'Grades conversion and trust', lighthouse: 'No', manual: 'Maybe', qualityos: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', qualityos: 'Yes' },
    { feature: 'Re-check after your agent fixes it', lighthouse: 'Manual', manual: 'Manual', qualityos: 'Built-in' },
    { feature: 'Runs inside Cursor or Claude', lighthouse: 'No', manual: 'No', qualityos: 'Yes' },
  ],
} as const

export const SOCIAL_PROOF = {
  headline: 'Even strong sites fail these checks',
  cta: 'See sample report',
  sample: {
    name: 'Stripe',
    score: 91,
    finding: '3 third-party scripts add ~80ms render delay',
  },
} as const

export const QUALITY_AREAS_SECTION = {
  headline: 'Everything we check in one report',
} as const

export const QUALITY_AREAS = [
  { name: 'Performance', impact: 'Slow pages lose visitors before they read a word' },
  { name: 'Accessibility', impact: 'Real users cannot complete key actions' },
  { name: 'SEO', impact: 'Broken previews and missing schema hide you on Google and Slack' },
  { name: 'Conversion', impact: 'Does the page guide someone to sign up or buy?' },
  { name: 'Trust', impact: 'Do you look legitimate enough to pay or share data?' },
  { name: 'Content', impact: 'Does the copy match what you are selling?' },
  { name: 'Mobile', impact: 'Where most AI-built sites break first' },
] as const

export const MCP_SECTION = {
  headline: 'Run audits from your editor',
  body: `Connect via MCP. Your agent in Cursor or Claude audits, fixes, and re-checks without you copy-pasting URLs.`,
  cta: 'See MCP setup',
  workflow: `User: "Audit https://myapp.com and fix the Mobile issues"

Claude calls: qos_audit_url → qos_get_area("Mobile")
Claude: "Mobile score is 41/100 (grade D). Here's what I found:
  - Primary CTA is below fold on 375px screens
  - 3 buttons with tap targets under 40px
  Should I apply fixes now?"
User: "Yes"
Claude: applies fixes
Claude: calls qos_recheck
Claude: "Mobile improved from 41 → 78 (D → B). 3 issues fixed."`,
} as const

export const PRICING_TEASER = {
  headline: 'Start free. Upgrade when you ship.',
  plans: [
    { name: 'Free', outcome: 'See what\u2019s broken', price: '$0' },
    { name: 'Builder', outcome: 'Fix everything, re-check everything', price: '$49/mo' },
    { name: 'Team', outcome: 'Monitor regressions across projects', price: '$199/mo' },
  ],
  cta: 'See full pricing',
} as const

export const MID_CTA = {
  headline: 'Run it on your site',
  trustLine: HERO.trustLine,
} as const

export const FINAL_CTA = {
  headline: 'Paste your URL. See your grade.',
  trustLine: HERO.trustLine,
} as const

export const FAQ_SECTION = {
  title: 'Common questions',
  viewAll: 'View all questions',
} as const

export const FAQ = [
  {
    question: 'What does QualityOS check that Lighthouse doesn\u2019t?',
    answer:
      'Lighthouse scores performance, accessibility, and SEO. QualityOS also grades conversion, trust, content, and mobile UX. Every finding includes evidence, launch impact, and a fix prompt for your AI editor.',
  },
  {
    question: 'Do I need an account for my first audit?',
    answer:
      'No. Paste any public URL and get a full audit in under 60 seconds. No account, no credit card. Create a free account to save reports and run 3 audits total.',
  },
  {
    question: 'What\u2019s included in the free plan vs Builder?',
    answer:
      'Free: top 3 findings per area, copyable fix prompts for visible findings, 3 audits total. Builder: full reports with all findings, all area prompts, re-check after fixes, audit history, and MCP API access.',
  },
  {
    question: 'Can it audit sites built with Lovable/Bolt/v0?',
    answer:
      'Yes. QualityOS audits any publicly accessible URL regardless of how it was built. Fix prompts are tuned for Cursor, Claude Code, Lovable, and Bolt.',
  },
  {
    question: 'How do fix prompts work with Cursor/Claude?',
    answer:
      'Each finding and area includes a copy-ready prompt with specific evidence from your page. Paste it into your AI agent and it knows exactly what to fix. With MCP, your agent fetches prompts automatically.',
  },
  {
    question: 'Can I re-check after my agent fixes issues?',
    answer:
      'Re-check is available on Builder and above. Run a new audit on the same URL and compare before/after scores to prove fixes worked.',
  },
  {
    question: 'Does it work on staging/password-protected sites?',
    answer:
      'QualityOS audits publicly accessible URLs only. Localhost, private networks, and password-protected pages are not supported yet.',
  },
  {
    question: 'Who is QualityOS for?',
    answer:
      'Solo builders and small teams shipping with AI coding tools who want to catch launch issues before sharing a link. Not built for enterprise QA teams running manual test suites.',
  },
] as const

/** Top objections for the home page — full list lives on /faq */
export const HOME_FAQ = [
  FAQ[0],
  FAQ[1],
  FAQ[3],
  FAQ[4],
  FAQ[7],
] as const

export const PRICING_FAQ = [
  {
    question: 'Can I start free and upgrade later?',
    answer: 'Yes. Run your first audit without an account. Create a free account for 3 audits total, then upgrade to Builder when you need full reports and re-checks.',
  },
  {
    question: 'What happens when I hit my audit limit?',
    answer: 'You\u2019ll see an upgrade prompt. Free accounts get 3 audits total (not monthly). Paid plans reset each billing cycle.',
  },
  {
    question: 'Is the founding offer permanent?',
    answer: 'Founding pricing locks in for your first 3 months on Builder and Studio. After that, standard pricing applies unless you cancel.',
  },
  {
    question: 'Do I need Builder for MCP?',
    answer: 'Yes. MCP API access requires a Builder plan or above. Generate an API key in Settings after upgrading.',
  },
  {
    question: 'What\u2019s included in every plan?',
    answer: 'All plans include evidence-backed findings and agent-ready fix prompts. Paid plans unlock full reports, re-check, and additional features per tier.',
  },
] as const

export const PRICING = {
  headline: 'Pay when you\u2019re shipping, not when you\u2019re browsing',
  subhead: 'Start free. Upgrade when you need full reports, re-checks, and in-editor audits via MCP.',
  foundingBadge: 'Founding offer active — lock in launch-week pricing',
  expertReview: {
    title: 'Expert Review — $500',
    body: 'A human reviews your audit and writes a prioritized fix plan. Perfect for launch week.',
    steps: [
      'Submit your latest audit report',
      'A quality expert prioritizes fixes by launch impact',
      'Get a launch checklist within 48 hours',
    ],
    cta: 'Get Expert Review',
  },
  allPlansInclude: 'All plans include evidence-backed findings and agent-ready prompts.',
} as const

export const PLANS = [
  {
    name: 'Free',
    plan: 'FREE' as const,
    price: '$0',
    period: '',
    persona: 'Try before launch',
    outcome: 'See what\u2019s broken',
    audits: '3 audits total',
    founding: undefined as string | undefined,
    features: ['Top 3 findings per area', 'Copyable fix prompts', 'No credit card'],
    cta: 'Get started free',
    href: '/sign-up',
    highlight: false,
  },
  {
    name: 'Builder',
    plan: 'BUILDER' as const,
    price: '$49',
    period: '/mo',
    persona: 'Solo builders shipping weekly',
    outcome: 'Fix everything, re-check everything',
    audits: '25 / month',
    founding: '$29/mo for 3 months',
    features: [
      'See every issue, not just the top 3',
      'All area prompts',
      'Prove your agent actually fixed it',
      'Audit history',
      'Audit from Cursor without switching tabs',
    ],
    cta: 'Start Builder',
    href: '/sign-up?plan=BUILDER',
    highlight: true,
  },
  {
    name: 'Team',
    plan: 'TEAM' as const,
    price: '$199',
    period: '/mo',
    persona: 'Small teams with multiple sites',
    outcome: 'Monitor regressions across projects',
    audits: '100 / month',
    founding: undefined as string | undefined,
    features: [
      'Everything in Builder',
      '5 projects',
      'Show stakeholders what improved',
      'Get alerted when a deploy breaks quality',
      'Priority queue',
    ],
    cta: 'Start Team',
    href: '/sign-up?plan=TEAM',
    highlight: false,
  },
  {
    name: 'Studio',
    plan: 'STUDIO' as const,
    price: '$999',
    period: '/mo',
    persona: 'Agencies and dev shops',
    outcome: 'Audit client sites at scale',
    audits: '500 / month',
    founding: '$499/mo for 3 months',
    features: [
      'Everything in Team',
      '20 projects',
      'Shareable public reports',
      'Agency use',
      'Priority support',
    ],
    cta: 'Start Studio',
    href: '/sign-up?plan=STUDIO',
    highlight: false,
  },
] as const

export const SAMPLES_PAGE = {
  subhead: 'This is what a completed QualityOS audit looks like.',
  bottomCta: 'Audit your site',
} as const

export const MCP_DOCS = {
  headline: 'MCP Integration',
  subhead:
    'Your agent can audit and fix your site without you copy-pasting URLs. Connect QualityOS to your AI coding tool.',
  quickStart: [
    'Create a free account and upgrade to Builder',
    'Go to Settings → API Keys and generate a key',
    'Add the config below to your editor',
    'Ask your AI agent to audit your site',
  ],
  builderRequired: 'Requires Builder plan',
  lovableBoltNote:
    'Lovable and Bolt don\u2019t support MCP yet. Copy fix prompts from the web UI or audit report directly into those tools.',
} as const

export const AUTH = {
  signIn: {
    title: 'Sign in to your account',
    cta: 'Sign in',
    footer: 'Don\u2019t have an account?',
    footerLink: 'Sign up',
  },
  signUp: {
    title: 'Create your free account',
    subtitle: 'Save audit history · 3 free audits · Upgrade anytime',
    cta: 'Create account',
    footer: 'Already have an account?',
    footerLink: 'Sign in',
    planTitles: {
      BUILDER: 'You\u2019re signing up for Builder — full reports from day one',
      TEAM: 'You\u2019re signing up for Team — monitoring and comparison included',
      STUDIO: 'You\u2019re signing up for Studio — audit client sites at scale',
    },
  },
} as const

export const UPSELLS = {
  anon: {
    headline: 'Don\u2019t lose this report',
    body: 'Create a free account to save history and run 3 audits total.',
    primaryCta: 'Create free account',
    secondaryCta: 'See paid plans',
  },
  freeUser: {
    headline: (hiddenCount: number) =>
      hiddenCount > 0
        ? `You have ${hiddenCount} hidden issue${hiddenCount !== 1 ? 's' : ''}`
        : 'Unlock full reports + re-check',
    body: 'Upgrade to see all findings and re-check after fixes.',
    cta: 'Upgrade to Builder — $49/mo',
  },
  areaGate: {
    hiddenFindings: (count: number) =>
      `+${count} more issue${count !== 1 ? 's' : ''} your agent could fix right now`,
    upgradeBody: 'Upgrade to Builder to see all findings and the full area prompt',
    areaPrompt: 'Upgrade for area prompt',
    unlockReport: 'Unlock full report',
  },
  atLimit: 'Audit limit reached. Upgrade to continue',
} as const

export const AUDIT_PROGRESS = {
  capturing: 'Taking screenshots...',
  checking: 'Running automated checks across performance, SEO, accessibility, and more...',
  judging: 'AI is analyzing your page...',
  completed: 'Report ready',
  inProgress: 'Auditing your site...',
  usuallyUnder: 'Usually under 60 seconds',
  stages: [
    { status: 'QUEUED', label: 'Starting audit', subtitle: 'Preparing your report...' },
    { status: 'CAPTURING', label: 'Capturing your page', subtitle: 'Desktop and mobile screenshots...' },
    { status: 'CHECKING', label: 'Running checks', subtitle: 'Performance, SEO, accessibility, and more...' },
    { status: 'JUDGING', label: 'AI review', subtitle: 'Turning findings into fix prompts...' },
  ],
  activity: [
    'Measuring load speed and Core Web Vitals...',
    'Checking SEO tags and link preview metadata...',
    'Scanning accessibility on images and headings...',
    'Reviewing trust signals like HTTPS and privacy links...',
    'Testing mobile layout and performance...',
    'Looking for conversion gaps in your hero and CTAs...',
    'Validating page structure and indexing signals...',
    'Checking console errors and broken resources...',
    'Reviewing meta tags and social sharing setup...',
    'Analyzing content clarity and call-to-action placement...',
    'Evaluating performance bottlenecks and render blocking...',
    'Cross-checking accessibility on forms and navigation...',
    'Summarizing findings for your fix prompts...',
    'Prioritizing issues by launch impact...',
    'Preparing your graded report...',
  ],
} as const

export const SEO = {
  home: {
    title: 'Check your site before you ship',
    description:
      'Paste any public URL. Graded on performance, SEO, mobile, conversion, and trust. Every finding includes a fix prompt for Cursor, Claude, Lovable, and Bolt.',
  },
  pricing: {
    title: 'Pricing',
    description:
      'Start free with 3 audits total. Upgrade to Builder for full reports, re-checks, and MCP integration. Founding offer active.',
  },
  samples: {
    title: 'Sample Report',
    description:
      'See a real QualityOS audit of stripe.com — evidence-backed findings with copy-ready fix prompts.',
  },
  mcp: {
    title: 'MCP Integration',
    description:
      'Connect QualityOS to Cursor, Claude Code, or Windsurf. Audit and fix your site without leaving your editor.',
  },
  faq: {
    title: 'FAQ',
    description:
      'Answers about QualityOS audits, fix prompts, free vs paid plans, MCP integration, and who it\u2019s for.',
  },
} as const

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualityos.com'
