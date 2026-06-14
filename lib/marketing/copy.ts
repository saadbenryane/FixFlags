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
  tagline: 'AI reviews your site like a person would',
  category: 'Automated checks + AI review with fix prompts',
  oneLiner: 'Paste a URL. AI reviews it like a person would.',
  tribeBadge: 'AI + automated checks',
} as const

/** Named once on the page — do not repeat in every section */
export const AI_TOOLS = 'Cursor, Claude, Lovable, and Bolt' as const

export const HERO = {
  headline: 'AI reviews your site like a person would',
  headlineLine1: 'AI reviews your site',
  headlineLine2: 'like a person would',
  headlineAccent: true,
  subhead:
    'Screenshots, automated checks, then an AI judge. Every issue includes a fix prompt.',
  trustLine: 'Free. No account. Under 60 seconds.',
  primaryCta: 'Audit my site',
  secondaryCta: 'See sample report',
} as const

export const HERO_MECHANISM_LINE =
  'Capture screenshots · Run checks · AI judge reads the page' as const

/** @deprecated Use HOW_IT_WORKS_SECTION — kept for backwards compatibility */
export const AI_REVIEW_SECTION = {
  label: 'How it works',
  headline: 'A review, not a dashboard',
  subhead: 'Lighthouse checks metrics. We read your screenshots.',
  steps: [
    {
      title: 'Capture',
      body: 'Desktop and mobile screenshots of your live page.',
    },
    {
      title: 'Check',
      body: 'Core Web Vitals, SEO tags, accessibility, console errors.',
    },
    {
      title: 'Judge',
      body: 'AI finds conversion gaps, trust issues, and unclear copy.',
    },
  ],
} as const

export const HOW_IT_WORKS_SECTION = {
  label: 'How it works',
  headline: 'From URL to fix prompt',
  subhead: 'Under 60 seconds. No account required.',
  steps: [
    {
      step: 1,
      title: 'Paste your URL',
      body: 'Any public page — new launch or live site.',
    },
    {
      step: 2,
      title: 'Capture and check',
      body: 'Desktop and mobile screenshots. Performance, SEO, accessibility, and more.',
    },
    {
      step: 3,
      title: 'AI reads the page',
      body: 'Finds conversion gaps, trust issues, and unclear copy.',
    },
    {
      step: 4,
      title: 'Fix and re-check',
      body: `Copy prompts into ${AI_TOOLS}. Compare before and after scores.`,
    },
  ],
} as const

export const SAMPLE_FINDINGS = [
  { area: 'Mobile', grade: 'C', issue: 'Primary CTA below fold at 375px' },
  { area: 'SEO', grade: 'D', issue: 'og:image missing. Link previews show blank.' },
  { area: 'Performance', grade: 'B', issue: '320KB of unused JavaScript' },
] as const

export const SAMPLE_FINDINGS_HEADER = 'AI review excerpt'
export const SAMPLE_FINDINGS_VERDICT =
  'Hero copy is vague. Mobile CTA is buried. Fix prompt on each finding.'

export const SAMPLE_FINDINGS_FOOTER = 'Each finding includes a copy-ready fix prompt'

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
  headline: 'AI review with fix prompts',
  rows: [
    { feature: 'Says why each issue hurts signups', lighthouse: 'Partial', manual: 'Yes', qualityos: 'Yes' },
    { feature: 'AI reads screenshots for UX gaps', lighthouse: 'No', manual: 'Yes', qualityos: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', qualityos: 'Yes' },
    { feature: 'Re-check after fixes', lighthouse: 'Manual', manual: 'Manual', qualityos: 'Built-in' },
    { feature: 'Runs inside Cursor or Claude', lighthouse: 'No', manual: 'No', qualityos: 'Yes' },
  ],
} as const

export const PROOF_SECTION = {
  label: 'Sample report',
  headline: 'Even 91/100 sites have gaps',
  subhead: 'See what automated scores miss on a site everyone trusts.',
  cta: 'See full sample report',
  sample: {
    name: 'Stripe',
    domain: 'stripe.com',
    score: 91,
    finding: '3 third-party scripts add ~80ms render delay',
    areasFlagged: 4,
  },
} as const

/** @deprecated Use PROOF_SECTION */
export const SOCIAL_PROOF = {
  headline: PROOF_SECTION.headline,
  cta: PROOF_SECTION.cta,
  sample: {
    name: PROOF_SECTION.sample.name,
    score: PROOF_SECTION.sample.score,
    finding: PROOF_SECTION.sample.finding,
  },
} as const

export const WHATS_CHECKED_SECTION = {
  label: 'Coverage',
  headline: 'Seven areas. One review.',
  subhead: 'Automated checks plus AI reading your screenshots.',
} as const

/** @deprecated Use WHATS_CHECKED_SECTION */
export const QUALITY_AREAS_SECTION = {
  headline: WHATS_CHECKED_SECTION.headline,
} as const

export const TRUST_STRIP = [
  'Free first audit',
  'No account',
  '7 areas checked',
  'Fix prompts included',
] as const

export const QUALITY_AREAS = [
  { name: 'Performance', impact: 'Slow pages lose visitors early' },
  { name: 'Accessibility', impact: 'Users cannot complete key actions' },
  { name: 'SEO', impact: 'Bad previews hide you on Google and Slack' },
  { name: 'Conversion', impact: 'Does the page say what to do next?' },
  { name: 'Trust', impact: 'Do you look safe to pay or sign up?' },
  { name: 'Content', impact: 'Does the copy match what you sell?' },
  { name: 'Mobile', impact: 'Where most visitors land first' },
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
    })),
  cta: 'See full pricing',
} as const

export const MID_CTA = {
  headline: 'Run it on your URL',
  trustLine: HERO.trustLine,
} as const

export const FINAL_CTA = {
  headline: 'Paste your URL',
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
    answer: 'Yes. Run your first audit without an account. Create a free account for 3 audits total, then upgrade to Builder when you need full reports and re-checks.',
  },
  {
    question: 'What happens when I hit my token limit?',
    answer: 'You\u2019ll see an upgrade prompt. Free accounts get 3 scan tokens total (not monthly). Paid plans reset each billing cycle.',
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
  allPlansInclude:
    'All plans include evidence-backed findings. Free shows human fix text for top findings; Builder+ unlocks full agent-ready prompts.',
} as const

export const PLANS = getMarketingPlans()

export const SAMPLES_PAGE = {
  subhead: 'This is what a completed QualityOS audit looks like on the free tier.',
  tierNote: 'Free shows top 3 findings per area. Builder unlocks every finding, area prompts, and re-check.',
  bottomCta: 'Audit your site',
} as const

export const MCP_DOCS = {
  headline: 'MCP Integration',
  subhead:
    'Your agent can audit and fix your site without you copy-pasting URLs. Connect QualityOS to your AI coding tool.',
  quickStart: [
    'Create a free account and upgrade to Builder',
    'Go to Settings → API Keys and generate a key',
    'Add the HTTP config below to your editor',
    'Ask your AI agent to audit your site',
  ],
  builderRequired: 'Requires Builder plan',
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
      BUILDER: 'You\u2019re signing up for Builder — full reports from day one',
      TEAM: 'You\u2019re signing up for Team — organize audits across up to 5 projects',
      STUDIO: 'You\u2019re signing up for Studio — audit client sites at scale with up to 20 projects',
    },
  },
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
  areaGate: {
    hiddenFindings: (count: number) =>
      `+${count} more issue${count !== 1 ? 's' : ''} your agent could fix right now`,
    upgradeBody: 'Upgrade to Builder to see all findings and the full area prompt',
    areaPrompt: 'Upgrade for area prompt',
    unlockReport: 'Unlock full report',
  },
  atLimit: 'Token limit reached. Upgrade to continue',
} as const

export const UPGRADE_MOMENTS = {
  hidden_findings: {
    headline: (hiddenCount: number) =>
      `+${hiddenCount} more issue${hiddenCount !== 1 ? 's' : ''} your agent could fix`,
    body: 'Upgrade to Builder to see every finding, full area prompts, and unlimited re-checks.',
    cta: 'Upgrade to Builder — $29/mo founding',
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
    body: 'Keep proving every ship with unlimited re-checks, full reports, and MCP in Cursor.',
    cta: 'Start Builder — $29/mo founding',
    plan: 'BUILDER' as const,
  },
  compare_flat: {
    headline: 'Unlock full prompts to fix what remains',
    body: 'Builder shows every issue and agent-ready area prompts so your editor can close the gaps.',
    cta: 'Upgrade to Builder — $29/mo founding',
    plan: 'BUILDER' as const,
  },
  trial_exhausted: {
    headline: "You've used your free re-check",
    body: 'Upgrade to Builder for unlimited re-checks and before/after comparisons on every ship.',
    cta: 'Upgrade to Builder — $29/mo founding',
    plan: 'BUILDER' as const,
  },
  share_blocked: {
    headline: 'Share client report links on Team',
    body: 'Send read-only audit links to stakeholders before your next client call.',
    cta: 'Start Team — $199/mo',
    plan: 'TEAM' as const,
  },
  free_default: {
    headline: 'Unlock full reports + re-check',
    body: 'Upgrade to see all findings and re-check after fixes.',
    cta: 'Upgrade to Builder — $29/mo founding',
    plan: 'BUILDER' as const,
  },
} as const

export const AUDIT_PROGRESS = {
  capturing: 'Taking screenshots...',
  checking: 'Running automated checks across performance, SEO, accessibility, and more...',
  judging: 'AI is analyzing your page...',
  completed: 'Report ready',
  inProgress: 'Auditing your site...',
  usuallyUnder: 'Usually under 60 seconds',
  workerQueuedWarning:
    'Audit is still queued. In local dev, run npm run dev:all so the worker processes jobs.',
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
    'Preparing your report...',
  ],
} as const

export const SEO = {
  home: {
    title: 'AI reviews your site like a person would',
    description:
      'Screenshots, automated checks, and an AI judge. Every issue includes a fix prompt. Free first audit.',
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
