/**
 * QualityOS marketing copy — single source of truth.
 *
 * Voice: operator clarity (see docs/voice-and-copy.md).
 * Do: short sentences, verb-first CTAs, name tools, lead with launch outcomes.
 * Don't: comprehensive, robust, leverage, unlock, 10x; over-promise free tier.
 */

export const BRAND = {
  name: 'QualityOS',
  tagline: 'Your agent built it. QualityOS checks if it works.',
  category: 'Post-build QA for AI-shipped apps',
  oneLiner: 'The quality layer between "AI shipped it" and "ready to launch."',
  tribeBadge: 'For teams shipping with AI agents',
  mechanismLine: 'The only audit that writes fix prompts your agent can run',
} as const

export const HERO = {
  headline: 'Your agent built it.',
  headlineAccent: 'QualityOS checks if it works.',
  subhead:
    'Run a 60-second audit across 7 quality areas. Get evidence-backed findings with copy-ready fix prompts for Cursor, Claude Code, Lovable, and Bolt. Re-check after your agent applies fixes.',
  trustLine: 'Free first audit — no account, no credit card. 60+ checks + AI analysis.',
  primaryCta: 'Audit my site',
  secondaryCta: 'See sample reports',
} as const

export const SAMPLE_FINDINGS = [
  { area: 'Mobile', grade: 'C', issue: 'Primary CTA below fold at 375px' },
  { area: 'SEO', grade: 'D', issue: 'og:image missing — link previews show blank' },
  { area: 'Performance', grade: 'B', issue: '320KB of unused JavaScript' },
] as const

export const SAMPLE_FINDINGS_FOOTER =
  'Each finding includes a copy-ready fix prompt for Cursor, Claude, Lovable, or Bolt'

export const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Paste your URL',
    body: 'Any public site — landing page, pricing, portfolio',
  },
  {
    step: 2,
    title: 'Get graded across 7 areas',
    body: 'Performance, Accessibility, SEO, Conversion, Trust, Content, Mobile',
  },
  {
    step: 3,
    title: 'Copy a fix prompt',
    body: 'One prompt per area, tuned for your AI tool',
  },
  {
    step: 4,
    title: 'Re-check after fixes',
    body: 'Before/after scores prove you actually improved',
  },
] as const

export const PROBLEM_SECTION = {
  headline: 'AI makes shipping fast. It doesn\u2019t make shipping right.',
  pains: [
    {
      title: 'Launch embarrassment',
      body: 'Mobile CTA below fold, broken link previews, 4s load times',
    },
    {
      title: 'Invisible SEO debt',
      body: 'Missing og:image, no structured data, weak meta',
    },
    {
      title: 'Conversion leaks',
      body: 'Generic hero copy, weak trust signals, unclear page job',
    },
  ],
} as const

export const DIFFERENTIATION = {
  headline: 'Not another audit score. A fix loop.',
  rows: [
    { feature: 'Business impact explained', lighthouse: 'Partial', manual: 'Yes', qualityos: 'Yes' },
    { feature: 'Conversion + trust analysis', lighthouse: 'No', manual: 'Maybe', qualityos: 'Yes' },
    { feature: 'Agent-ready fix prompts', lighthouse: 'No', manual: 'No', qualityos: 'Yes' },
    { feature: 'Re-check after fixes', lighthouse: 'Manual', manual: 'Manual', qualityos: 'Built-in' },
    { feature: 'Works in Cursor/Claude via MCP', lighthouse: 'No', manual: 'No', qualityos: 'Yes' },
  ],
} as const

export const SOCIAL_PROOF = {
  headline: 'We audit real sites. Here\u2019s what we find.',
  samples: [
    { name: 'Stripe', score: 91, finding: '3 third-party scripts add ~80ms render delay' },
    { name: 'Linear', score: 78, finding: 'Mobile LCP is 3.8s. Hero video loads before text content.' },
    { name: 'Cal.com', score: 63, finding: 'Mobile PageSpeed score 43 — primary CTA below fold on 375px' },
  ],
} as const

export const QUALITY_AREAS = [
  { name: 'Performance', impact: 'Slow pages kill conversion before anyone reads your copy' },
  { name: 'Accessibility', impact: 'Real users can\u2019t use your app; legal risk on public sites' },
  { name: 'SEO', impact: 'Broken previews and missing schema = invisible on Google and Slack' },
  { name: 'Conversion', impact: 'Is the page actually doing its job?' },
  { name: 'Trust', impact: 'Do you look legitimate enough to pay or sign up?' },
  { name: 'Content', impact: 'Does the copy match what you\u2019re selling?' },
  { name: 'Mobile', impact: 'Most AI-built sites break here first' },
] as const

export const MCP_SECTION = {
  headline: 'Audit without leaving your editor',
  body: 'Connect QualityOS to Cursor, Claude Code, or Windsurf via MCP. Your agent audits, fixes, and re-checks without copy-pasting URLs.',
  cta: 'Set up MCP integration',
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

export const FINAL_CTA = {
  headline: 'Find out if you\u2019re launch-ready',
  trustLine: HERO.trustLine,
} as const

export const FAQ = [
  {
    question: 'What does QualityOS check that Lighthouse doesn\u2019t?',
    answer:
      'Lighthouse scores performance, accessibility, and SEO. QualityOS adds conversion analysis, trust signals, content quality, and mobile UX — then writes fix prompts your AI agent can run. Every finding includes evidence and business impact, not just a metric.',
  },
  {
    question: 'Do I need an account for my first audit?',
    answer:
      'No. Paste any public URL and get a full audit in under 60 seconds — no account, no credit card. Create a free account to save reports and run 3 audits total.',
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
      'Solo builders and small teams shipping with AI coding tools who need to launch with confidence — not enterprise QA teams running manual test suites.',
  },
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
  headline: 'Real audits. Real sites. Real issues.',
  subhead:
    'These are the kinds of problems AI-built sites ship with, and the prompts QualityOS generates to fix them.',
  findingsFooter:
    'Each finding includes a copy-ready fix prompt for Cursor, Claude Code, Lovable, and Bolt.',
  bottomHeadline: 'Audit your site now',
  bottomCta: 'Start auditing',
  cardCta: 'Audit a site like this',
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
  checking: 'Running 60+ checks across performance, SEO, accessibility, and more...',
  judging: 'AI is analyzing your page...',
  completed: 'Report ready',
  inProgress: 'Auditing your site...',
} as const

export const SEO = {
  home: {
    title: 'Post-build QA for AI-shipped apps',
    description:
      'Your agent built it. QualityOS checks if it works. Run a 60-second audit across 7 quality areas with copy-ready fix prompts for Cursor, Claude Code, Lovable, and Bolt.',
  },
  pricing: {
    title: 'Pricing',
    description:
      'Start free with 3 audits total. Upgrade to Builder for full reports, re-checks, and MCP integration. Founding offer active.',
  },
  samples: {
    title: 'Sample Reports',
    description:
      'See real QualityOS audits of Stripe, Linear, and Cal.com. Evidence-backed findings with copy-ready fix prompts.',
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
