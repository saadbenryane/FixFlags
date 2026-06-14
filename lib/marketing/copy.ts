/**
 * QualityOS marketing copy — single source of truth.
 *
 * Voice: operator clarity (see docs/voice-and-copy.md).
 * Do: short sentences, verb-first CTAs, name tools, lead with launch outcomes.
 * Don't: comprehensive, robust, leverage, unlock, 10x; over-promise free tier.
 */

import { getMarketingPlans } from '@/lib/billing/plans'

export const BRAND = {
  name: 'QualityOS',
  tagline: 'Your agent built it. QualityOS checks it.',
  category: 'Automated checks + AI review with fix prompts',
  oneLiner: 'Paste a URL. Get a report with fix prompts on every issue.',
  tribeBadge: 'AI checks for agents',
} as const

/** Named once on the page — do not repeat in every section */
export const AI_TOOLS = 'Cursor, Claude, Lovable, and Bolt' as const

export const HERO = {
  headline: 'Your agent built it. QualityOS checks it.',
  headlineLine1: 'Your agent built it.',
  headlineLine2: 'QualityOS checks it.',
  headlineAccent: true,
  subhead:
    'AI reviews desktop and mobile screenshots across 7 areas. Every issue includes a copy-ready fix prompt your agent can run.',
  trustLine: 'Free · No account · Usually under 90 seconds',
  primaryCta: 'Run audit',
  secondaryCta: 'See sample report',
} as const

export const HERO_MECHANISM_LINE =
  'Screenshots · Automated checks · AI review · Fix prompts' as const

export const HERO_FIX_PROMPT = {
  label: 'Example fix prompt',
  finding: 'Mobile CTA below fold at 375px',
  prompt:
    'Move the primary CTA above the fold on 375px viewport. Current CTA starts at 1,200px from top. Hero should fit in first viewport with CTA visible without scrolling.',
} as const

export const HOW_IT_WORKS_SECTION = {
  label: 'How it works',
  headline: 'Three steps to a fix list',
  subhead: 'No account required for your first audit.',
  steps: [
    {
      step: 1,
      title: 'Paste your URL',
      body: 'Any public page — new launch or live site.',
    },
    {
      step: 2,
      title: 'AI reviews the page',
      body: 'Screenshots plus seven checks across performance, SEO, mobile, and conversion.',
    },
    {
      step: 3,
      title: 'Copy fix prompts',
      body: `Paste into ${AI_TOOLS}, or connect MCP to audit, fix, and re-check with before/after compare.`,
    },
  ],
} as const

export const SAMPLE_FINDINGS = [
  { area: 'Mobile', grade: 'C', issue: 'Primary CTA below fold at 375px' },
  { area: 'SEO', grade: 'D', issue: 'og:image missing. Link previews show blank.' },
  { area: 'Performance', grade: 'B', issue: '320KB of unused JavaScript' },
] as const

export const SAMPLE_FINDINGS_HEADER = 'Sample report'

export const WORKFLOW_SECTION = {
  headline: 'From review to fix',
} as const

export const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Paste your URL',
    body: 'Any public page',
  },
  {
    step: 2,
    title: 'Read the review',
    body: 'Evidence and why each issue matters',
  },
  {
    step: 3,
    title: 'Copy a fix prompt',
    body: `Into ${AI_TOOLS}, or to your dev`,
  },
  {
    step: 4,
    title: 'Re-check',
    body: 'Before/after scores',
  },
] as const

export const PROBLEM_SECTION = {
  headline: 'Tools miss what people notice.',
  pains: [
    {
      title: 'Off on mobile',
      body: 'CTA below the fold. Tap targets too small.',
    },
    {
      title: 'Blank when shared',
      body: 'Missing og:image. Empty link cards.',
    },
    {
      title: 'Unclear next step',
      body: 'Visitors leave. Weak trust signals.',
    },
  ],
} as const

export const DIFFERENTIATION = {
  headline: 'Lighthouse vs QualityOS',
  subhead: 'Automated checks don\'t catch what a human — or AI — sees in a screenshot.',
  rows: [
    { feature: 'Says why each issue hurts signups', lighthouse: 'Partial', manual: 'Yes', qualityos: 'Yes' },
    { feature: 'AI reads screenshots for UX gaps', lighthouse: 'No', manual: 'Yes', qualityos: 'Yes' },
    { feature: 'Identifies missing og:image', lighthouse: 'Partial', manual: 'Yes', qualityos: 'Yes' },
    { feature: 'Checks mobile CTA placement', lighthouse: 'No', manual: 'Yes', qualityos: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', qualityos: 'Yes' },
    { feature: 'Re-check after fixes', lighthouse: 'Manual', manual: 'Manual', qualityos: 'Built-in' },
    { feature: 'Re-check proof loop', lighthouse: 'No', manual: 'No', qualityos: 'Yes (Pro)' },
    { feature: 'Runs inside Cursor or Claude', lighthouse: 'No', manual: 'No', qualityos: 'Yes' },
  ],
} as const

export const SOCIAL_PROOF = {
  headline: 'Built for agent-first builders',
  toolingLine: 'Cursor · Claude Code · Lovable · Bolt',
  tools: ['Cursor', 'Claude Code', 'Lovable', 'Bolt'] as const,
  testimonial: {
    label: 'Example feedback',
    quote: 'Fixed our og:image after the first audit. Link previews in Slack now show our branding instead of blank cards.',
    author: 'Founder',
    company: 'B2B SaaS, 3-person team',
  },
} as const

export const CASE_STUDIES = [
  {
    id: 'og-image',
    company: 'SaaS landing page',
    title: 'Illustrative: Fixed og:image',
    issue: 'Every page used the same generic og:image. Link previews looked identical when shared.',
    fix: 'Added per-page og:image via `/api/og` with title and category overlay.',
    outcome: 'Each page type returns a unique preview card. Illustrative SEO area improvement after fix.',
    area: 'SEO',
    scoreBefore: 64,
    scoreAfter: 78,
    link: '/examples#example-vercel',
    proofLink: '/examples#ex-vercel-seo-1',
    proofType: 'Sample audit' as const,
  },
  {
    id: 'mobile-cta',
    company: 'E-commerce storefront',
    title: 'Illustrative: Moved CTA up on mobile',
    issue: 'Primary CTA started at 950px on a 375x812 viewport — hidden below the fold.',
    fix: 'Restructured mobile hero so CTA appears within the first viewport.',
    outcome: 'CTA visible without scrolling at 375px. Illustrative Mobile area improvement after fix.',
    area: 'Mobile',
    scoreBefore: 58,
    scoreAfter: 78,
    link: '/examples#example-vercel',
    proofLink: '/examples#ex-vercel-mobile-1',
    proofType: 'Sample audit' as const,
  },
  {
    id: 'hero-clarity',
    company: 'DevTools homepage',
    title: 'Illustrative: Rewrote hero copy',
    issue: 'Headline described actions, not outcome: "Develop. Preview. Ship."',
    fix: 'Rewrote to outcome-driven headline naming audience and benefit.',
    outcome: 'Headline names audience and outcome explicitly. Illustrative Content area improvement after fix.',
    area: 'Content',
    scoreBefore: 44,
    scoreAfter: 82,
    link: '/examples#example-vercel',
    proofLink: '/examples#ex-vercel-conv-2',
    proofType: 'Sample audit' as const,
  },
] as const

export const PROOF_SECTION = {
  label: 'Sample report',
  headline: 'Even high-scoring sites have gaps',
  subhead: 'See what automated scores miss on a site everyone trusts.',
  cta: 'Audit your site',
  sample: {
    name: 'Stripe',
    domain: 'stripe.com',
    finding: '3 third-party scripts add measurable render delay on desktop',
    areasFlagged: 4,
  },
} as const

export const WHATS_CHECKED_SECTION = {
  label: 'Rubric',
  headline: 'Two score formats, one rubric',
  subhead: 'Each area includes score, what we check, and a fix prompt your agent can run.',
} as const

export const TRUST_STRIP = [
  '7 areas checked',
  'Fix prompts included',
  'Re-check after fixes',
] as const

export const QUALITY_AREAS = [
  { name: 'Performance', impact: 'Slow pages lose visitors early', scoreFormat: '0–100', whatWeCheck: 'Core Web Vitals, bundle sizes, render blocking, image optimization' },
  { name: 'Accessibility', impact: 'Users cannot complete key actions', scoreFormat: '0–100', whatWeCheck: 'Contrast ratios, keyboard nav, screen reader support, focus order' },
  { name: 'SEO', impact: 'Bad previews hide you on Google and Slack', scoreFormat: '0–100', whatWeCheck: 'Meta tags, og:image, structured data, heading hierarchy' },
  { name: 'Conversion', impact: 'Does the page say what to do next?', scoreFormat: 'A–F', whatWeCheck: 'CTA placement, value prop clarity, signup friction' },
  { name: 'Trust', impact: 'Do you look safe to pay or sign up?', scoreFormat: 'A–F', whatWeCheck: 'Privacy links, security badges, social proof, brand consistency' },
  { name: 'Content', impact: 'Does the copy match what you sell?', scoreFormat: 'A–F', whatWeCheck: 'Headline clarity, feature communication, readability' },
  { name: 'Mobile', impact: 'Where most visitors land first', scoreFormat: '0–100', whatWeCheck: 'Tap targets, viewport CTA visibility, font sizes, animations' },
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
  headline: 'Start free. Pay when you need more.',
  plans: getMarketingPlans()
    .filter((p) => p.plan === 'FREE' || p.plan === 'BUILDER' || p.plan === 'TEAM')
    .map((p) => ({
      name: p.name,
      outcome: p.outcome,
      price: `${p.price}${p.period}`,
      cta: p.cta,
      href: p.href,
    })),
  cta: 'See full pricing',
} as const

export const FINAL_CTA = {
  headline: 'Audit your site',
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
      'Lighthouse scores performance, accessibility, and SEO. QualityOS adds an AI judge that reads your screenshots for conversion, trust, content, and mobile UX. Every finding includes evidence and a fix prompt.',
  },
  {
    question: 'Do I need an account for my first audit?',
    answer:
      'No. Paste any public URL and get a full audit in under 60 seconds. No account, no credit card. Create a free account to save reports and run 3 audits total.',
  },
  {
    question: 'What\u2019s included in the free plan vs Pro?',
    answer:
      'Free: full report with all findings and fix prompts, 3 audits total, and one free re-check. Pro: unlimited re-checks with before/after compare, MCP in Cursor or Claude, and 25 audits per month.',
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
      'Registered free users get one free re-check to compare before/after scores. Paid plans include unlimited re-checks that do not count against your monthly new-URL audit limit.',
  },
  {
    question: 'Does it work on staging/password-protected sites?',
    answer:
      'QualityOS audits publicly accessible URLs only. Localhost, private networks, and password-protected pages are not supported yet.',
  },
  {
    question: 'We already have a live site. Is this only for pre-launch?',
    answer:
      'No. QualityOS audits any public page, live or new. Most live sites still fail conversion, trust, or mobile checks even when performance scores look fine.',
  },
  {
    question: 'Who is QualityOS for?',
    answer:
      'Solo builders, founders, and small teams with a new launch or a live site that should convert better. Works with AI editors like Cursor and Claude, or hand off fix prompts to your dev. Not built for enterprise QA teams running manual test suites.',
  },
] as const

/** Top objections for the home page — full list lives on /faq */
export const HOME_FAQ = [
  FAQ[0],
  FAQ[1],
  FAQ[7],
  FAQ[4],
  FAQ[8],
] as const

export const PRICING_FAQ = [
  {
    question: 'Can I start free and upgrade later?',
    answer: 'Yes. Run your first audit without an account. Create a free account for 3 audits total, then upgrade to Pro when you need unlimited re-checks and MCP.',
  },
  {
    question: 'What happens when I hit my audit limit?',
    answer: 'You\u2019ll see an upgrade prompt. Free accounts get 3 audits total (not monthly). Paid plans reset each billing cycle.',
  },
  {
    question: 'Is the founding offer permanent?',
    answer: 'Founding pricing locks in for your first 3 months on Pro and Studio. After that, standard pricing applies unless you cancel.',
  },
  {
    question: 'Do I need Pro for MCP?',
    answer: 'Yes. MCP API access requires a Pro plan or above. Generate an API key in Settings after upgrading.',
  },
  {
    question: 'What\u2019s included in every plan?',
    answer: 'Every plan includes the full report and copy-ready fix prompts. Paid plans add unlimited re-checks, MCP, higher audit volume, and team features.',
  },
] as const

export const PRICING = {
  headline: 'Pay when you\u2019re shipping, not when you\u2019re browsing',
  subhead: 'Start free with the full report. Upgrade when you ship weekly and need unlimited re-checks and MCP.',
  foundingBadge: 'Founding offer active — lock in launch-week pricing',
  upgradeSteps: 'Create account → Stripe checkout → Dashboard',
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
  allPlansInclude:
    'Every audit includes evidence, fix prompts, and area summaries. Pro adds the ship loop: re-check, compare, and audit from your editor.',
} as const

export const PLANS = getMarketingPlans()

export const SAMPLES_PAGE = {
  subhead: 'This is what a completed QualityOS audit looks like — full report, all findings.',
  tierNote: 'Free includes the full report. Pro adds unlimited re-checks and MCP in your editor.',
  bottomCta: 'Audit your site',
} as const

export const MCP_DOCS = {
  headline: 'MCP Integration',
  subhead:
    'Your agent can audit and fix your site without you copy-pasting URLs. Connect QualityOS to your AI coding tool.',
  quickStart: [
    'Create a free account and upgrade to Pro',
    'Go to Settings → API Keys and generate a key',
    'Add the HTTP config below to your editor',
    'Ask your AI agent to audit your site',
  ],
  builderRequired: 'Requires Pro plan',
  lovableBoltNote:
    'Lovable and Bolt don\u2019t support MCP yet. Copy fix prompts from the web UI or audit report directly into those tools.',
  tools: [
    { name: 'qos_audit_url', desc: 'Start a quality audit on any URL. Returns auditId.' },
    { name: 'qos_get_audit_status', desc: 'Check if an audit is complete.' },
    { name: 'qos_get_report', desc: 'Get the full report with all 7 area grades and scores.' },
    {
      name: 'qos_get_area',
      desc: 'Get detailed findings + fix prompt for one area (Performance, SEO, Mobile, etc.)',
    },
    { name: 'qos_get_finding', desc: 'Get the fix prompt for a specific finding.' },
    { name: 'qos_recheck', desc: 'Run a new audit on the same URL to verify fixes.' },
    {
      name: 'qos_compare',
      desc: 'Compare two audits — see what improved, stayed the same, or regressed.',
    },
  ],
  configExamples: {
    claudeCode: `# ~/.claude/mcp.json
{
  "mcpServers": {
    "qualityos": {
      "url": "https://qualityos.com/api/mcp",
      "headers": {
        "x-api-key": "qos_live_your_key_here"
      }
    }
  }
}`,
    cursor: `# .cursor/mcp.json
{
  "mcpServers": {
    "qualityos": {
      "url": "https://qualityos.com/api/mcp",
      "headers": {
        "x-api-key": "qos_live_your_key_here"
      }
    }
  }
}`,
    windsurf: `# ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "qualityos": {
      "serverUrl": "https://qualityos.com/api/mcp",
      "headers": {
        "x-api-key": "qos_live_your_key_here"
      }
    }
  }
}`,
  },
  configLabels: {
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
  },
} as const

export const AUTH = {
  signIn: {
    title: 'Sign in to your account',
    subtitle: 'Use your email and password to continue',
    subtitleWithOAuth: 'Continue with Google or GitHub, or use email',
    cta: 'Sign in',
    footer: 'Don\u2019t have an account?',
    footerLink: 'Sign up',
    forgotPassword: 'Forgot password?',
  },
  signUp: {
    title: 'Create your free account',
    subtitle: 'Save audit history · 3 free audits · Upgrade anytime',
    subtitleWithOAuth: 'Continue with Google or GitHub, or create with email',
    cta: 'Create account',
    footer: 'Already have an account?',
    footerLink: 'Sign in',
    planTitles: {
      BUILDER: 'You\u2019re signing up for Pro — unlimited re-checks and MCP from day one',
      TEAM: 'You\u2019re signing up for Agency — organize audits across up to 5 projects',
      STUDIO: 'You\u2019re signing up for Studio — audit client sites at scale with up to 20 projects',
    },
    planSteps: [
      'Create your account',
      'Complete payment in Stripe',
      'Run your first audit from the dashboard',
    ],
  },
  valueProps: [
    { icon: 'history' as const, text: 'Audit history saved to your account' },
    { icon: 'reports' as const, text: 'Re-open reports and copy fix prompts anytime' },
    { icon: 'recheck' as const, text: 'Re-check after fixes to track improvement' },
  ],
  privacyNote: 'By creating an account, you agree to our',
  forgotPassword: {
    title: 'Reset your password',
    subtitle: 'Enter your email and we\u2019ll send a reset link',
    sentSubtitle: 'Check your inbox',
    sentBody: 'If an account exists for that email, we sent a password reset link.',
    cta: 'Send reset link',
    backToSignIn: 'Back to sign in',
    error: 'Could not send reset email. Try again.',
    notConfigured: 'Password reset requires email to be configured on the server.',
  },
  resetPassword: {
    title: 'Choose a new password',
    subtitle: 'Must be at least 8 characters',
    cta: 'Update password',
    mismatch: 'Passwords do not match',
    success: 'Password updated. Sign in with your new password.',
    error: 'Could not reset password. The link may have expired.',
    invalidTitle: 'Invalid reset link',
    invalidSubtitle: 'This link expired or was already used',
    invalidBody: 'Request a new password reset link to continue.',
    requestNewLink: 'Request a new link',
  },
} as const

export const UPSELLS = {
  anon: {
    headline: 'Don\u2019t lose this report',
    body: 'Create a free account to save history and run 3 audits total.',
    primaryCta: 'Create free account',
    secondaryCta: 'See paid plans',
  },
  atLimit: 'Token limit reached. Upgrade to continue',
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You\u2019ve used your 3 free audits',
    body: 'Upgrade to Pro for 25 audits per month, unlimited re-checks, and MCP in Cursor or Claude.',
    cta: 'Upgrade to Pro — $29/mo founding',
    plan: 'BUILDER' as const,
  },
  trial_recheck_available: {
    headline: 'Prove your fixes worked',
    body: 'Paste fix prompts into your editor, ship changes, then re-check once for free to compare before/after scores.',
    cta: 'Use your free re-check',
    plan: 'BUILDER' as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) =>
      `Score improved ${scoreDelta > 0 ? `+${scoreDelta}` : ''}`.trim(),
    body: 'Keep proving every ship with unlimited re-checks and MCP in Cursor.',
    cta: 'Start Pro — $29/mo founding',
    plan: 'BUILDER' as const,
  },
  compare_flat: {
    headline: 'Still gaps after your re-check',
    body: 'Pro gives unlimited re-checks and MCP so your agent can close what remains without copy-pasting URLs.',
    cta: 'Upgrade to Pro — $29/mo founding',
    plan: 'BUILDER' as const,
  },
  trial_exhausted: {
    headline: "You've used your free re-check",
    body: 'Upgrade to Pro for unlimited re-checks and before/after comparisons on every ship.',
    cta: 'Upgrade to Pro — $29/mo founding',
    plan: 'BUILDER' as const,
  },
  free_default: {
    headline: 'Ship weekly? Automate the loop',
    body: 'Pro adds unlimited re-checks, before/after compare, and MCP so audits run inside Cursor or Claude.',
    cta: 'Upgrade to Pro — $29/mo founding',
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Unlock full audit history and automation',
    body: 'Pro adds unlimited re-checks, before/after proof, MCP in Cursor or Claude, and saved report history — not just more checks.',
    cta: 'Upgrade to Pro — $29/mo founding',
    plan: 'BUILDER' as const,
  },
} as const

export const AUDIT_PROGRESS = {
  capturing: 'Taking screenshots...',
  checking: 'Running automated checks across performance, SEO, accessibility, and more...',
  judging: 'AI is analyzing your page...',
  completed: 'Report ready',
  inProgress: 'Auditing your site...',
  usuallyUnder: 'Usually under 90 seconds',
  workerQueuedWarning:
    'Audit is still queued. In local dev, run npm run dev:all so the worker processes jobs.',
  stages: [
    { status: 'QUEUED', label: 'Starting audit', subtitle: 'Preparing your report...' },
    { status: 'CAPTURING', label: 'Capturing screenshots', subtitle: 'Desktop and mobile views...' },
    { status: 'CHECKING', label: 'Running checks', subtitle: 'Performance, SEO, accessibility, and more...' },
    { status: 'JUDGING', label: 'AI review', subtitle: 'Turning findings into fix prompts...' },
    { status: 'FINALIZING', label: 'Preparing report', subtitle: 'Scoring areas and packaging results...' },
  ],
  stageActivity: {
    QUEUED: ['Queueing your audit...', 'Spinning up the pipeline...'],
    CAPTURING: ['Capturing desktop screenshot...', 'Capturing mobile screenshot...', 'Loading page in browser...'],
    CHECKING: [
      'Measuring load speed and Core Web Vitals...',
      'Checking SEO tags and link preview metadata...',
      'Scanning accessibility on images and headings...',
      'Reviewing trust signals like HTTPS and privacy links...',
      'Testing mobile layout and performance...',
      'Looking for conversion gaps in your hero and CTAs...',
    ],
    JUDGING: [
      'AI is analyzing screenshots and findings...',
      'Generating agent-ready fix prompts...',
      'Prioritizing issues by launch impact...',
    ],
    FINALIZING: ['Packaging your report...', 'Scoring all 7 areas...', 'Almost ready...'],
  },
} as const

export const SEO = {
  home: {
    title: 'QualityOS — Your agent built it. QualityOS checks it.',
    description:
      'AI reviews desktop and mobile screenshots across 7 areas. Every issue includes a copy-ready fix prompt your agent can run. Free first audit.',
  },
  pricing: {
    title: 'Pricing',
    description:
      'Start free with the full report and 3 audits. Upgrade to Pro for unlimited re-checks and MCP. Founding offer active.',
  },
  samples: {
    title: 'Sample Report',
    description:
      'See a real QualityOS audit of stripe.com — evidence-backed findings with copy-ready fix prompts.',
  },
  examples: {
    title: 'Example Audits',
    description:
      'Automated QualityOS audits of recognizable sites like web.dev, Vercel, and Wikipedia. Illustrative, not endorsements.',
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
  privacy: {
    title: 'Privacy Policy',
    description: 'How QualityOS collects and uses your data.',
  },
  terms: {
    title: 'Terms of Service',
    description: 'Terms for using QualityOS.',
  },
} as const

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualityos.com'
