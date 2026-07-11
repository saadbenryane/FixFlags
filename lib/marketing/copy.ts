/**
 * FixFlags marketing copy. Single source of truth.
 *
 * Voice: sharp senior reviewer. Clear, calm, direct. No hype.
 * Do: short sentences, verb-first CTAs, name tools, lead with what to fix.
 * Don't: comprehensive, robust, leverage, unlock, 10x; over-promise free tier.
 */

import { getMarketingPlans, proUpgradeCta } from '@/lib/billing/plans'

export const BRAND = {
  name: 'FixFlags',
  domain: 'fixflags.com',
  tagline: 'The QA layer for AI-built products.',
  category: 'The QA layer for AI-built products.',
  oneLiner: 'FixFlags is the QA layer for AI-built products.',
  supportEmail: 'hello@fixflags.com',
  mcpServerKey: 'fixflags',
  exportPrefix: 'FixFlags Report',
  tribeBadge: 'Finish what your AI started',
} as const

/** Named once on the page. Do not repeat in every section */
export const AI_TOOLS = 'Cursor, Claude, Lovable, and Bolt' as const

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com'

export const OUTPUT_LABELS = {
  whatYouGet: 'Sample output',
  fixPrompt: 'Fix prompt (copy-ready)',
  seeFullSample: 'See full sample report',
  nextStep: 'Paste into editor → run → monitor.',
} as const

export const TOOLS = {
  metaPreview: {
    badge: 'Free Tool',
    heading: 'Meta Preview Tool',
    subhead:
      'See how your page looks when shared on Slack, X, LinkedIn, and Discord. Enter a URL to check its og:image, title, and description tags.',
    ctaCheck: 'Check preview',
    ctaAudit: 'Run full audit on this URL',
    metaTagsHeading: 'Meta Tags',
    metaFieldLabels: {
      title: 'Title',
      description: 'Description',
      ogTitle: 'og:title',
      ogDescription: 'og:description',
      ogImage: 'og:image',
      twitterCard: 'twitter:card',
      twitterImage: 'twitter:image',
      favicon: 'Favicon',
    },
    missing: 'Missing',
    canonicalPresent: 'Canonical',
    canonicalMissing: 'No canonical',
    robotsPresent: 'Robots meta',
    robotsMissing: 'No robots meta',
    auditHeading: 'Run a full audit',
    auditSubhead:
      'Get a complete report across Message, Experience, and Reach with fix prompts your AI agent can run.',
  },
  placeholderDetector: {
    badge: 'Free Tool',
    heading: 'Placeholder Copy Detector',
    subhead:
      'Scan any URL for Lorem ipsum, TODO markers, AI-builder template artifacts, and unreplaced tokens. One less thing to miss before you share the link.',
    ctaScan: 'Scan page',
    noIssuesIconAria: 'Clean page',
    noIssuesHeading: 'No placeholder content found',
    noIssuesSubhead:
      'This page looks clean. No template artifacts, placeholder copy, or unreplaced tokens detected.',
    issuesFound: '{count} issue{plural} found',
    typeLabels: {
      placeholder: 'Placeholder',
      'template-copy': 'Template Copy',
      'ai-builder': 'AI Builder Artifact',
      'template-token': 'Template Token',
      'social-proof': 'Social Proof Issue',
    },
    auditHeading: 'Run a full audit',
    auditSubhead:
      'Get a complete report across Message, Experience, and Reach with fix prompts your AI agent can run.',
  },
  shared: {
    auditHeading: 'Run a full audit',
    auditSubhead:
      'Get a complete report across Message, Experience, and Reach with fix prompts your AI agent can run.',
    ctaAudit: 'Run full audit on this URL',
  },
} as const

export const HERO = {
  badge: 'Finish what your AI started.',
  headline: 'Finish what your AI started.',
  headlineLine1: 'what your',
  headlineLine2: 'AI started.',
  headlineAccent: 'Finish',
  audienceLine: '',
  headlineAccentLegacy: false,
  subhead:
    'Review your AI-built site before you share the link. Catch broken messaging, mobile layout issues, and missing link previews. Get copy-ready fix prompts your builder can run.',
  trustLine: 'Check the page before users see it.',
  supportingLine: 'Check the page before users see it.',
  primaryCta: 'Review my site',
  navSignUpCta: 'Try free',
  trySampleCta: 'View sample report',
  urlPlaceholder: 'your-site.com',
  trustBadgesSubtitle: 'See what users see',
  trustBadges: [
    'See what users see',
    'Copy-ready fix prompts',
    'Evidence & screenshots',
    'Try it for Free',
  ] as const,
} as const

export const SEGMENT_PROOF_SECTION = {
  label: 'Who it\u2019s for',
  headline: 'Before you share the link',
  subhead: 'Same report. Different moment.',
  tiles: [
    {
      id: 'ai-shipper',
      title: 'About to ship',
      job: 'Catch what your builder missed before the launch post.',
      proof: `Flags and fix prompts for ${AI_TOOLS}.`,
    },
    {
      id: 'live-site',
      title: 'Already live',
      job: 'See what the public page is still costing you.',
      proof: 'Flags across Message, Experience, and Reach rubrics.',
    },
  ],
} as const

export const HERO_FIX_PROMPT = {
  label: OUTPUT_LABELS.fixPrompt,
  finding: 'Primary CTA below fold at 375px',
  prompt:
    'Move the primary CTA above the fold on 375px viewport. Current button starts at 1,200px from top. Hero should fit in first viewport with the main action visible without scrolling.',
} as const

export const HOW_IT_WORKS_SECTION = {
  label: 'How it works',
  headline: 'Flag, fix, monitor',
  subhead: 'Three steps: flag, fix, monitor.',
  steps: [
    {
      step: 1,
      title: 'Flag',
      body: 'Paste a URL and run an audit. Get Flags across Message, Experience, and Reach with desktop and mobile screenshots.',
    },
    {
      step: 2,
      title: 'Fix',
      body: `Copy-ready prompts for ${AI_TOOLS}. Paste into your editor or repo and ship fixes.`,
    },
    {
      step: 3,
      title: 'Monitor',
      body: 'Run the audit again on the same URL to confirm Flags cleared before users find the problems.',
    },
  ],
} as const

export const SAMPLE_FINDINGS = [
  { area: 'Experience', grade: 'C', issue: 'Primary CTA below fold at 375px' },
  { area: 'Reach', grade: 'D', issue: 'Social preview image missing. Link previews show blank.' },
  { area: 'Experience', grade: 'B', issue: '320KB of unused JavaScript' },
] as const

export const SAMPLE_FINDINGS_HEADER = OUTPUT_LABELS.whatYouGet

export const WORKFLOW_SECTION = {
  headline: 'From Flag to fix',
} as const

export const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Paste your URL',
    body: 'Any public page',
  },
  {
    step: 2,
    title: 'Read the Flags',
    body: 'Evidence and why each issue matters',
  },
  {
    step: 3,
    title: 'Copy a fix prompt',
    body: `Into ${AI_TOOLS}, or to your dev`,
  },
  {
    step: 4,
    title: 'Monitor',
    body: 'Confirm Flags cleared',
  },
] as const

export const PROBLEM_SECTION = {
  label: 'Why you miss this in reviews',
  headline: 'Your builder shipped fast. The gaps show up when someone opens the link.',
  subhead:
    'Message, layout, and share-preview issues slip past quick reviews until a URL goes public.',
  pains: [
    {
      title: 'Off on mobile',
      body: 'Main action below the fold. Buttons too small to tap on mobile.',
      fixPrompt: 'Fix prompt for layout + button sizing',
    },
    {
      title: 'Blank when shared',
      body: 'Missing social preview image. Empty link cards on Slack and X.',
      fixPrompt: 'Fix prompt for social preview image',
    },
    {
      title: 'Unclear next step',
      body: 'Visitors leave without knowing what to do. Weak trust at the pay step.',
      fixPrompt: 'Fix prompt for main action + trust',
    },
  ],
} as const

export const DIFFERENTIATION = {
  label: 'Why FixFlags',
  headline: 'More than a Lighthouse score',
  subhead: 'Automated checks miss what a reviewer sees in a screenshot.',
  lighthouseLinkText: 'Compare FixFlags checks with Google Lighthouse',
  is: [
    'A review layer that finishes what your AI started',
    'Flags with evidence, impact, and copy-ready fix prompts',
    'Monitoring loop to prove fixes landed',
  ],
  isNot: [
    'Not a generic Lighthouse wrapper',
    'Not manual QA-as-a-service',
    'Not an enterprise test suite',
  ],
  bullets: [
    'AI reads screenshots for message, experience, and reach gaps',
    'Every Flag ships with a copy-ready fix prompt',
    'Monitoring proves fixes landed (Pro)',
  ],
  rows: [
    { feature: 'Says why each Flag hurts conversion', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'AI reads screenshots for UX gaps', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Identifies missing og:image', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Checks mobile CTA placement', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', fixflags: 'Yes' },
    { feature: 'Monitoring after fixes', lighthouse: 'Manual', manual: 'Manual', fixflags: 'Built-in' },
    { feature: 'Monitoring proof loop', lighthouse: 'No', manual: 'No', fixflags: 'Yes (Pro)' },
    { feature: 'Public share links for clients', lighthouse: 'No', manual: 'No', fixflags: 'Yes (Agency)' },
    { feature: 'Runs inside Cursor or Claude', lighthouse: 'No', manual: 'No', fixflags: 'Yes' },
  ],
  comparisonRows: [
    { feature: 'Says why each Flag hurts conversion', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'AI reads screenshots for UX gaps', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Identifies missing social preview image', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Checks mobile button placement', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', fixflags: 'Yes' },
  ],
} as const

export const SOCIAL_PROOF = {
  headline: 'Even strong sites fail these checks',
  worksWithHeading: 'Works with',
  toolingLine: 'Cursor · Claude Code · Lovable · Bolt',
  tools: ['Cursor', 'Claude Code', 'Lovable', 'Bolt'] as const,
  testimonial: {
    label: 'Example feedback',
    quote:
      'Fixed our social preview image after the first check. Link previews in Slack now show our branding instead of blank cards.',
    author: 'Founder',
    company: 'B2B SaaS, 3-person team',
  },
} as const

export const CASE_STUDIES = [
  {
    id: 'og-image',
    company: 'SaaS landing page',
    title: 'Fixed social preview image',
    outcome: 'Added per-page social preview images. Each page type returns a unique preview card.',
    area: 'Reach',
    scoreBefore: 64,
    scoreAfter: 78,
    link: '/examples#example-vercel',
    proofLink: '/examples#ex-vercel-seo-1',
    proofType: 'Sample report' as const,
  },
  {
    id: 'mobile-cta',
    company: 'E-commerce storefront',
    title: 'Moved primary button up on mobile',
    outcome: 'Restructured mobile hero. Main action visible without scrolling at 375px.',
    area: 'Experience',
    scoreBefore: 58,
    scoreAfter: 78,
    link: '/examples#example-vercel',
    proofLink: '/examples#ex-vercel-mobile-1',
    proofType: 'Sample report' as const,
  },
  {
    id: 'hero-clarity',
    company: 'DevTools homepage',
    title: 'Rewrote hero copy',
    outcome: 'Headline now names audience and outcome. Message rubric improved.',
    area: 'Message',
    gradeBefore: 'D' as const,
    gradeAfter: 'B' as const,
    link: '/examples#example-vercel',
    proofLink: '/examples#ex-vercel-conv-2',
    proofType: 'Sample report' as const,
  },
] as const

export const CASE_STUDIES_SECTION = {
  label: 'Monitoring',
  headline: 'Fixes that clear Flags',
  subhead: 'Illustrative monitoring after applying fix prompts.',
} as const

export const PROOF_SECTION = {
  label: OUTPUT_LABELS.whatYouGet,
  headline: 'Flags, screenshots, and fix prompts',
  subhead:
    'Real output from a public URL. Copy a fix prompt, paste it into your editor, then monitor to prove the fix.',
  nextStep: OUTPUT_LABELS.nextStep,
  cta: 'Check My Site',
  sample: {
    name: 'LaunchPad',
    domain: 'fixflags.com/demo',
    finding: 'Hero headline repeats the product category instead of the outcome',
    areasFlagged: 6,
  },
} as const

export const TRUST_STRIP = HERO.trustBadges

export const FLOW_SCAN_STATUS = {
  success: {
    label: 'Passed',
    description: 'The primary CTA navigated to a meaningful destination.',
  },
  no_cta: {
    label: 'No CTA found',
    description: 'No clickable signup, pricing, or get-started control was visible in the viewport.',
  },
  unclickable: {
    label: 'CTA not clickable',
    description: 'A CTA was detected but could not be clicked (overlay, disabled, or obscured).',
  },
  error_response: {
    label: 'Error page',
    description: 'The CTA destination returned a 4xx or 5xx HTTP status.',
  },
  dead_end: {
    label: 'Dead end',
    description: 'Clicking the CTA did not change the URL or page content meaningfully.',
  },
  external_leave: {
    label: 'Left your domain',
    description: 'The CTA sent users to an external site instead of signup or pricing on your domain.',
  },
  skipped: {
    label: 'Skipped',
    description: 'Flow scan could not run during this audit. Try a full monitoring.',
  },
  timeout: {
    label: 'Timed out',
    description: 'Flow scan exceeded the time limit before completing the click-through.',
  },
} as const

export const IMPACT_TAGS = {
  CONVERSION: { label: 'Conversion', description: 'Affects whether visitors take the next step' },
  REVENUE: { label: 'Revenue', description: 'Affects willingness to pay or upgrade' },
  TRUST: { label: 'Trust', description: 'Affects credibility and safety signals' },
  MEASUREMENT: { label: 'Measurement', description: 'Affects analytics and event tracking' },
  SHARING: { label: 'Sharing', description: 'Affects link previews and social cards' },
  SEO: { label: 'SEO', description: 'Affects search visibility and metadata' },
  ACCESSIBILITY: { label: 'Accessibility', description: 'Affects keyboard, contrast, and assistive use' },
} as const

export const SEVERITY_LABELS = {
  CRITICAL: { label: 'Critical', description: 'Fix before you share the link' },
  IMPORTANT: { label: 'Important', description: 'Fix soon; hurts conversion or trust' },
  POLISH: { label: 'Polish', description: 'Worth fixing; not blocking launch' },
} as const

export const FLAG_STATUS_LABELS = {
  OPEN: { label: 'Open', description: 'Not fixed yet' },
  FIXED: { label: 'Fixed', description: 'Resolved in a monitoring audit' },
  IGNORED: { label: 'Ignored', description: 'Acknowledged and skipped' },
  REGRESSED: { label: 'Regressed', description: 'Came back after a fix' },
} as const

export const PRODUCT_LADDER = {
  headline: 'Start free. Upgrade when you ship weekly.',
  steps: [
    {
      plan: 'FREE',
      title: 'Check',
      body: 'Full report with Flags and fix prompts. Three checks total.',
    },
    {
      plan: 'BUILDER',
      title: 'Prove',
      body: 'Unlimited monitoring, before/after compare, and MCP in your editor.',
    },
    {
      plan: 'TEAM',
      title: 'Share',
      body: 'Client-ready share links, proof exports, and projects for agencies and client-driven teams.',
    },
  ],
} as const

export const MCP_SECTION = {
  headline: 'Run checks from your editor',
  body: 'Connect via MCP so your agent finds Flags, fixes them, and monitors without copy-pasting URLs.',
  intro: 'A typical prompt sequence looks like this:',
  closing: 'Then monitor to prove the improvement.',
  cta: 'See MCP setup',
  workflow: `User: "Check https://myapp.com and review the Experience rubric"

Claude calls: ff_check_url → ff_get_rubric("EXPERIENCE")
Claude: "Experience needs attention. Two Flags:
  - Primary CTA is below fold on 375px screens
  - 3 buttons with tap targets under 40px
  Should I apply fixes now?"
User: "Yes"
Claude: applies fixes
Claude: calls ff_monitoring
Claude: "Experience improved from Needs Attention → Pass. Two Flags cleared."`,
} as const

export const HOW_IT_WORKS_PAGE = {
  hero: {
    eyebrow: 'How FixFlags works',
    headline: 'Check your site from the browser or your coding agent.',
    subhead:
      'Paste a URL for an instant report, or connect FixFlags through MCP so Cursor, Claude Code, and Windsurf can find issues, fetch fix prompts, and monitor the page.',
    primaryCta: 'Run a browser check',
    secondaryCta: 'Set up MCP',
  },
  modes: [
    {
      label: 'On the site',
      title: 'Paste a URL and get the report',
      body: 'Use the web app when you want a fast outside-in review of a live page, preview deploy, or client URL.',
      bullets: [
        'Message, Experience, and Reach rubrics',
        'Desktop and mobile evidence',
        'Pass / Needs Attention / Blocked status',
      ],
      cta: 'Review my site',
      href: '/#audit',
    },
    {
      label: 'In your editor',
      title: 'Let your agent call FixFlags with MCP',
      body: 'Use MCP when you want the fix loop to stay inside Cursor, Claude Code, or Windsurf.',
      bullets: [
        'Check a URL from chat',
        'Fetch the exact flag and fix prompt',
        'Monitor after the agent applies changes',
      ],
      cta: 'View MCP setup',
      href: '/docs/mcp',
    },
  ],
  reportPreview: {
    label: 'What the report gives you',
    title: 'Not a score dump. A fix queue.',
    body: 'Each Flag explains what broke, where we saw it, why it matters, and what to paste into your builder.',
    flags: [
      {
        rubric: 'Experience',
        status: 'Needs Attention',
        finding: 'Primary action starts below the first mobile viewport.',
        evidence: 'Mobile screenshot (375px) shows the CTA after 1,080px of scrolling.',
      },
      {
        rubric: 'Reach',
        status: 'Blocked',
        finding: 'The page has no share preview image.',
        evidence: 'Social and Slack previews render as a blank card.',
      },
      {
        rubric: 'Message',
        status: 'Needs Attention',
        finding: 'Hero copy says what the product is, not who it helps.',
        evidence: 'Headline and subhead do not name the buyer, task, or outcome.',
      },
    ],
  },
  loop: {
    label: 'The operating loop',
    title: 'Scan, fix, verify. Repeat when the page changes.',
    steps: [
      {
        title: 'Scan the public page',
        body: 'FixFlags loads the page like a user, captures evidence, and grades the three rubrics.',
      },
      {
        title: 'Send the fix to your builder',
        body: 'Copy the prompt manually or let MCP hand the exact Flag to your coding agent.',
      },
      {
        title: 'Monitor the shipped change',
        body: 'Run the same URL again and keep the history in your dashboard.',
      },
    ],
  },
  mcp: {
    label: 'MCP workflow',
    title: 'The agent can use the same product API you do.',
    body: 'MCP turns FixFlags into a tool your agent can call, so site QA is part of the coding loop instead of a separate tab.',
    transcript: `User: "Check the landing page and fix the highest-impact issue"

Agent calls: ff_check_url
Agent reads: Experience rubric and top Flag
Agent applies: mobile CTA layout fix
Agent calls: ff_monitoring
Agent reports: "Experience moved to Pass. One Flag cleared."`,
  },
  finalCta: {
    headline: 'Start in the browser. Graduate to MCP when the loop is working.',
    body: 'The same report powers both workflows, so your team can review manually today and automate the fix loop tomorrow.',
    primaryCta: 'Review my site',
    secondaryCta: 'Connect MCP',
  },
} as const

const PRICING_TEASER_BULLETS: Record<'FREE' | 'BUILDER' | 'TEAM', readonly string[]> = {
  FREE: ['Unlimited monitoring on your reports', 'No share links', 'No export'],
  BUILDER: ['Monitoring loop', 'Before/after compare', 'Editor integration (MCP)'],
  TEAM: ['Client-ready share links', 'Proof exports', 'Up to 5 projects'],
}

export const PRICING_TEASER = {
  headline: PRODUCT_LADDER.headline,
  subhead: 'Full report on every plan. Pro adds unlimited monitoring and MCP in your editor.',
  trustLine: 'Cancel anytime · No account for first check · Recurring monthly',
  plans: getMarketingPlans()
    .filter((p) => p.plan === 'FREE' || p.plan === 'BUILDER' || p.plan === 'TEAM')
    .map((p) => ({
      name: p.name,
      outcome: p.outcome,
      price: `${p.price}${p.period}`,
      features: PRICING_TEASER_BULLETS[p.plan as 'FREE' | 'BUILDER' | 'TEAM'],
      cta: p.cta,
      href: p.href,
    })),
  cta: 'See full pricing',
} as const

export const FINAL_CTA = {
  headline: 'Paste your URL.',
  headlineAccent: 'See what to fix.',
  body: 'Run an audit, copy fix prompts, and re-scan to watch your score climb. Create a free account to save history and get fix prompts.',
} as const

export const CHANGELOG_ENTRIES = [
  {
    date: '2026-07-02',
    title: 'FixFlags launches in open beta',
    items: [
      'Sign up and create your account to start testing your sites',
      'Run free checks on any live or preview URL',
      'Get results across Message, Experience, and Reach with Pass / Needs Attention / Blocked status',
      'Fix-ready prompts for Cursor, Claude Code, Lovable, Bolt, and Windsurf',
      'View your report history and AI tool usage from your dashboard',
    ],
  },
] as const

export const BLOG_POSTS = [
  {
    slug: 'why-ai-built-sites-need-a-second-pass',
    title: 'Why AI-built sites need a second pass',
    date: '2026-07-02',
    excerpt:
      'AI coding tools ship fast, but speed skips the boring checks: dead CTAs, broken previews, missing alt text. Here is why a second pass matters before you share the link.',
    body: [
      'AI coding tools are very good at producing a page that looks finished. They are much less good at noticing the things that only show up when someone else actually uses the page: a call-to-action that points nowhere, an Open Graph image that never loads, a form input with no label.',
      'None of these are hard to fix. Almost all of them are invisible until a real user, or a QA pass, goes looking.',
      'That gap is what "finish what your AI started" means in practice. The build gets you 90% of the way. The last 10% is the pass that catches what speed skipped, and it is exactly the kind of checklist work that is easy to automate and easy to skip when you are moving fast.',
      'A second pass does not need to be a person. It needs to be systematic: run the checks, get the flags, fix what matters, ship. The habit is the re-check, not the first check.',
    ],
  },
] as const

export const LANDING_PAGE = {
  logoCloud: {
    label: 'Trusted by builders using',
    disclaimer: 'Tool compatibility only. Not an endorsement by these companies.',
    logos: ['Cursor', 'Codex', 'Lovable', 'Bolt', 'Claude Code', 'Windsurf'] as const,
  },
  checkDimensions: {
    label: 'What it checks',
    headline: 'Every product breaks in three places.',
    exampleFindingLabel: 'Example finding',
    cards: [
      {
        id: 'message',
        title: 'Message',
        question: 'Can people understand and care?',
        icon: 'message',
        tint: 'brand',
        checks: [
          'Clarity in the first five seconds',
          'Positioning that names the audience',
          'Copy and story that make the next step obvious',
          'CTA and proof that reduce hesitation',
        ] as const,
        proofExample: {
          finding: 'Hero value is unclear',
          evidence: '"Build something amazing with AI"',
        },
      },
      {
        id: 'experience',
        title: 'Experience',
        question: 'Can people use it without friction?',
        icon: 'experience',
        tint: 'success',
        checks: [
          'Mobile layout and tap targets',
          'Primary flow friction',
          'Accessibility and performance blockers',
          'Trust signals like HTTPS and privacy links',
        ] as const,
        proofExample: {
          finding: 'Primary CTA below fold at 375px',
          evidence: 'Main action starts at 1,200px on mobile',
        },
      },
      {
        id: 'reach',
        title: 'Reach',
        question: 'Can people find and share it?',
        icon: 'reach',
        tint: 'info',
        checks: [
          'Metadata and canonical basics',
          'Social preview readiness',
          'Indexability and shareability',
          'Search snippets people can understand',
        ] as const,
        proofExample: {
          finding: 'Social preview image missing',
          evidence: 'Link previews show blank on Slack and X',
        },
      },
    ] as const,
  },
  howItWorks: {
    label: 'How it works',
    headline: 'From scan to ship. In one loop.',
    subhead:
      'Paste a URL. Get findings and fix prompts. Monitor when you ship fixes.',
    sampleLink: 'View full sample review',
    steps: [
      {
        step: 1,
        title: 'Scan',
        body: 'We scan your live site in seconds.',
        preview: 'yourproduct.com',
      },
      {
        step: 2,
        title: 'Flag',
        body: 'We surface the issues that actually matter.',
        preview: 'High-impact flags',
        previewBadge: 'Flags',
      },
      {
        step: 3,
        title: 'Fix',
        body: 'Your AI agent gets exact prompts and context.',
        preview: 'Agent-ready fix',
      },
      {
        step: 4,
        title: 'Verify',
        body: 'We monitor and show what improved.',
        preview: 'Monitoring complete',
        previewBadge: 'Improved',
      },
    ] as const,
  },
  testimonials: {
    label: 'Example feedback',
    headline: 'Example feedback from builders',
    subhead: 'What people tend to notice after a first audit.',
    disclaimer: 'Paraphrased examples. Not verbatim quotes or named endorsements.',
    quotes: [
      {
        id: 'prelaunch-mobile',
        quote:
          'Mobile CTA was below the fold. I would have posted the launch link without catching it.',
        role: 'Indie builder',
        context: 'Pre-launch',
      },
      {
        id: 'homepage-list',
        quote:
          'Short prioritized list I could forward to our dev. No Lighthouse dump, no SEO rabbit hole.',
        role: 'Founder, live SaaS',
        context: 'Homepage audit',
      },
      {
        id: 'slack-preview',
        quote:
          'Fixed our social preview image after the first check. Slack links finally show our branding instead of blank cards.',
        role: 'Founder, B2B SaaS',
        context: 'Link previews',
      },
      {
        id: 'client-handoff',
        quote:
          'I send clients the share link instead of a Loom walkthrough. They see the evidence themselves.',
        role: 'Freelance designer',
        context: 'Agency workflow',
      },
      {
        id: 'cursor-fix',
        quote:
          'Copied the fix prompt into Cursor and shipped the change in one sitting. No back-and-forth in Slack.',
        role: 'Solo dev',
        context: 'Fix in editor',
      },
      {
        id: 'hero-clarity',
        quote:
          'Our redesign looked polished but the hero still did not say who it was for. That was the first flag.',
        role: 'Marketing lead',
        context: 'Post-redesign',
      },
    ] as const,
  },
  sampleReport: {
    label: 'Sample review',
    headline: 'A review your AI agent can act on.',
    body: 'Each flag includes evidence, business impact, and the exact fix. No noise. Just what matters.',
    cta: 'View full sample review',
    illustrativeLabel: 'Illustrative scores',
  },
  footer: {
    tagline:
      'Evidence-backed reviews for AI-built and live sites. Find what visitors are missing, with fix prompts your editor can run.',
    madeWith: 'Built for people shipping with AI.',
    newsletter: {
      title: 'Stay in the loop',
      placeholder: 'Enter your email',
      cta: 'Subscribe',
      blurb: 'Product updates and shipping tips. No spam.',
      success: 'You\u2019re on the list.',
      alreadySubscribed: 'You\u2019re already on the list.',
      emailRequired: 'Enter your email address',
      subscribeFailed: 'Could not subscribe right now. Try again later.',
    },
    social: {
      instagram: 'https://instagram.com/fixedflax',
    },
  },
} as const

export const FAQ_SECTION = {
  title: 'Common questions',
  viewAll: 'View all questions',
  label: 'FAQ',
} as const

export const FAQ_PAGE = {
  title: 'Frequently asked questions',
  subhead: 'Everything you need to know about FixFlags checks, Flags, fix prompts, and plans.',
} as const

export const FAQ = [
  {
    question: 'What does FixFlags check that Lighthouse doesn\u2019t?',
    answer:
      'Lighthouse scores performance, accessibility, and SEO. FixFlags adds an AI reviewer that reads your screenshots for message, experience, and reach gaps, including trust and credibility signals. Every Flag includes evidence and a fix prompt. Results are grouped into three sections: Message, Experience, and Reach.',
  },
  {
    question: 'How are FixFlags checks organized?',
    answer:
      'Every report groups findings into three sections. Message covers copy and positioning. Experience covers layout, usability, and performance. Reach covers SEO metadata and link previews. Each section shows what we found and a fix prompt your agent can run.',
  },
  {
    question: 'What does the Message section check?',
    answer:
      'Headline clarity, placeholder copy, dead CTA links, audience fit, and pricing confidence.',
  },
  {
    question: 'What does the Experience section check?',
    answer:
      'Layout, mobile usability, accessibility basics, Core Web Vitals, and automated CTA click-through.',
  },
  {
    question: 'What does the Reach section check?',
    answer:
      'SEO metadata, live search and social preview cards, og:image validation, and indexability.',
  },
  {
    question: 'Do I need an account for my first check?',
    answer:
      'No. Your first scan is free, no account needed. Create a free account to keep scanning and to unlock 3 AI reports with fix prompts and saved history.',
  },
  {
    question: 'What\u2019s included in the free plan vs Pro?',
    answer:
      'Free: unlimited deterministic checks, 3 AI reports with fix prompts, and unlimited monitoring on reports you own. Pro: before/after compare, MCP in Cursor or Claude, and 25 new checks per month.',
  },
  {
    question: 'Can it check sites built with Lovable/Bolt/v0?',
    answer:
      'Yes. FixFlags checks any publicly accessible URL regardless of how it was built. Fix prompts are tuned for Cursor, Claude Code, Lovable, and Bolt.',
  },
  {
    question: 'How do fix prompts work with Cursor/Claude?',
    answer:
      'Each Flag includes a copy-ready prompt with specific evidence from your page. Paste it into your AI agent and it knows exactly what to fix. With MCP, your agent fetches prompts automatically.',
  },
  {
    question: 'Can I monitor after my agent fixes issues?',
    answer:
      'All registered users can monitor reports they own as often as needed. Monitoring does not count against your new-URL limit. Pro adds before/after compare and MCP in your editor.',
  },
  {
    question: 'Does it work on staging/password-protected sites?',
    answer:
      'FixFlags checks publicly accessible URLs only. Localhost, private networks, and password-protected pages are not supported yet.',
  },
  {
    question: 'We already have a live site. Is this only for pre-launch?',
    answer:
      'No. FixFlags checks any public page, live or new. Most live sites still fail message, experience, or reach Flags even when performance scores look fine.',
  },
  {
    question: 'Who is FixFlags for?',
    answer:
      'Builders and small teams shipping with AI tools like Cursor, Lovable, and Bolt. Check the page before users see the link. Not built for enterprise QA teams running manual test suites.',
  },
] as const

/** Top objections for the home page: full list lives on /faq */
export const HOME_FAQ = [
  FAQ[0],
  FAQ[5],
  FAQ[11],
  FAQ[8],
  FAQ[12],
] as const

export const PRICING_FAQ = [
  {
    question: 'Can I start free and upgrade later?',
    answer:
      'Yes. Your first scan is free without an account. Create a free account to keep scanning and unlock 3 AI reports with fix prompts, then upgrade to Pro when you need unlimited monitoring and MCP.',
  },
  {
    question: 'What happens when I hit my check limit?',
    answer:
      'You\u2019ll see an upgrade prompt. Free accounts get 3 AI reports total (not monthly). Paid plans reset each billing cycle.',
  },
  {
    question: 'Do I need Pro for MCP?',
    answer: 'Yes. MCP API access requires a Pro plan or above. Generate an API key in Settings after upgrading.',
  },
  {
    question: 'What\u2019s included in every plan?',
    answer:
      'Every plan includes the full report and copy-ready fix prompts. Paid plans add unlimited monitoring, MCP, higher check volume, and team features.',
  },
] as const

export const PRICING = {
  headline: 'Start free. Pay when you ship.',
  subhead:
    'Start free with the full report. Upgrade when you ship weekly and need unlimited monitoring and MCP.',
  foundingBadge: 'Founding price. Keep this rate as we grow.',
  upgradeSteps: 'Create account → Stripe checkout → Dashboard',
  upgradeStepsLoggedIn: 'Stripe checkout → Dashboard',
  allPlansInclude:
    'Every check includes evidence, fix prompts, and rubric summaries. Pro adds the ship loop: monitoring, compare, and check from your editor.',
} as const

export const PLANS = getMarketingPlans()

export const SAMPLES_PAGE = {
  subhead: 'This is what a completed FixFlags report looks like: full report, all Flags.',
  tierNote: 'Free includes the full report. Pro adds unlimited monitoring and MCP in your editor.',
} as const

export const REPORT_COPY = {
  launchGates: {
    title: 'Launch gates',
    body: 'Five concrete checks from your report evidence. Fix any failed gates before you ship.',
  },
  monitoringHint: {
    title: 'Next: prove your fixes worked',
    bodyPrefix: 'Paste fix prompts into your editor, ship the changes, then hit',
    bodySuffix: 'above to compare before/after.',
  },
  sampleCta: {
    title: 'Run the same check on your site',
    body: 'Paste a URL. See Flags across three rubrics and copy-ready fix prompts for your agent.',
  },
} as const

export const MCP_DOCS = {
  headline: 'MCP Integration',
  subhead:
    'Your agent can check and fix your site without you copy-pasting URLs. Connect FixFlags to your AI coding tool.',
  quickStart: [
    'Generate an API key in Settings → API Keys (Pro plan)',
    'Paste the HTTP config into Cursor, Claude Code, or Windsurf',
    'Run ff_check_url: use the curl test below to verify your key',
  ],
  builderRequired: 'Requires Pro plan',
  expectationsTitle: 'What to expect',
  expectations: [
    {
      label: 'Plan',
      title: 'Pro plan required',
      body: 'API keys and MCP access are included with Pro.',
    },
    {
      label: 'Works with',
      title: 'Cursor, Claude Code, and Windsurf',
      body: 'Paste the config into your editor, then run checks from your coding workflow.',
    },
    {
      label: 'Wait time',
      title: 'Checks may queue',
      body: 'When FixFlags is busy, your editor receives an estimated wait before the check starts.',
    },
    {
      label: 'URL support',
      title: 'Public URLs only',
      body: 'Live and preview URLs work. Localhost and private sites are not reachable yet.',
    },
  ],
  lovableBoltNote:
    'Lovable and Bolt do not support MCP yet. Copy fix prompts from your FixFlags report and paste them into those tools.',
  tools: [
    { name: 'ff_check_url', desc: 'Start a check on any URL. Returns reportId.' },
    { name: 'ff_get_check_status', desc: 'Check if a report is complete.' },
    { name: 'ff_get_report', desc: 'Get rubric summaries (scores, grades, status) and shareStatus. Use ff_get_rubric or ff_get_flag for fix prompts.' },
    {
      name: 'ff_get_rubric',
      desc: 'Get detailed flags + fix prompt for one rubric (Message, Experience, Reach).',
    },
    { name: 'ff_get_flag', desc: 'Get the fix prompt for a specific flag.' },
    { name: 'ff_monitoring', desc: 'Run a new check on the same URL to verify fixes.' },
    {
      name: 'ff_compare',
      desc: 'Compare two reports: see what improved, stayed the same, or regressed.',
    },
    {
      name: 'ff_list_recent_audits',
      desc: 'List recent audits with status, score, and key metadata.',
    },
    {
      name: 'ff_start_repo_scan',
      desc: 'Start a GitHub repository code scan for an allow-listed repo.',
    },
    {
      name: 'ff_list_repo_scans',
      desc: 'List recent GitHub repository scans and finding counts.',
    },
    {
      name: 'ff_get_repo_scan',
      desc: 'Get a GitHub repository scan and code findings.',
    },
    {
      name: 'ff_get_repo_finding',
      desc: 'Get a branch-ready fix task for one repository finding.',
    },
    {
      name: 'generate-fix-prompt',
      desc: 'Generate a custom fix prompt from any problem description.',
    },
  ],
  configExamples: {
    claudeCode: `# ~/.claude/mcp.json
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "url": "${SITE_URL}/api/mcp",
      "headers": {
        "x-api-key": "ff_live_your_key_here"
      }
    }
  }
}`,
    cursor: `# .cursor/mcp.json
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "url": "${SITE_URL}/api/mcp",
      "headers": {
        "x-api-key": "ff_live_your_key_here"
      }
    }
  }
}`,
    windsurf: `# ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "serverUrl": "${SITE_URL}/api/mcp",
      "headers": {
        "x-api-key": "ff_live_your_key_here"
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
    trustLine: 'Your report history stays on your account.',
    tryWithoutAccount: 'Try without an account',
    cta: 'Sign in',
    footer: 'Don\u2019t have an account?',
    footerLink: 'Sign up',
    forgotPassword: 'Forgot password?',
    oauthNote: 'We never post or access your repositories.',
  },
  signUp: {
    title: 'Create your free account',
    subtitle: 'Unlimited deterministic checks · 3 AI reports · Upgrade anytime',
    subtitleWithOAuth: 'Continue with Google or GitHub, or create with email',
    fromPricing: 'Create your free account: 3 AI reports included, upgrade anytime',
    oauthNote: 'We never post or access your repositories.',
    cta: 'Create account',
    footer: 'Already have an account?',
    footerLink: 'Sign in',
    planTitles: {
      BUILDER: 'You\u2019re signing up for Pro, unlimited monitoring and MCP from day one',
      TEAM: 'You\u2019re signing up for Agency, ship client-ready share links and organize across up to 5 projects',
    },
    planSteps: [
      'Create your account',
      'Complete payment in Stripe',
      'Run your first check from the dashboard',
    ],
  },
  valueProps: [
    { icon: 'history' as const, text: 'Report history saved to your account' },
    { icon: 'reports' as const, text: 'Re-open reports and copy fix prompts anytime' },
    { icon: 'monitoring' as const, text: 'Monitor after fixes to track improvement' },
  ],
  privacyNote: 'By creating an account, you agree to our Privacy Policy and Terms of Service.',
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
    headline: 'Unlock copy-paste fix prompts',
    body: 'You already see your score and issues. Create a free account to unlock the fix prompts, save scan history, and re-scan to verify your fixes.',
    primaryCta: 'Create free account',
    secondaryCta: 'See paid plans',
  },
  atLimit: 'AI report limit reached. Upgrade to continue',
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You\u2019ve used your 3 AI reports',
    body: 'Upgrade to Pro for 25 checks per month, unlimited monitoring, and MCP in Cursor or Claude.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) =>
      `Score improved ${scoreDelta > 0 ? `+${scoreDelta}` : ''}`.trim(),
    body: 'Keep proving every ship with unlimited monitoring and MCP in Cursor.',
    cta: proUpgradeCta('Start Pro'),
    plan: 'BUILDER' as const,
  },
  compare_flat: {
    headline: 'Still Flags after your monitoring',
    body: 'Pro gives unlimited monitoring and MCP so your agent can close what remains without copy-pasting URLs.',
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
    body: 'Copy a client-ready summary with rubrics and top Flags. Upgrade to Agency to unlock exports.',
    cta: 'Upgrade to Agency',
    plan: 'TEAM' as const,
  },
  free_default: {
    headline: 'Ship weekly? Automate the loop',
    body: 'Pro adds unlimited monitoring, before/after compare, and MCP so checks run inside Cursor or Claude.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Unlock full report history and automation',
    body: 'Pro adds unlimited monitoring, before/after proof, MCP in Cursor or Claude, and saved report history.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
} as const

export const AUDIT_ERRORS = {
  checkFailedTitle: 'Check failed',
  retryCta: 'Retry',
  checkAnotherSite: 'Check another site',
  goHome: 'Go home',
  startCheck: 'Check My Site',
  reportNotFoundTitle: 'Report not found',
  reportNotFoundBody: 'This report does not exist or has been removed.',
  accessDeniedTitle: 'Access denied',
  accessDeniedBody: 'You do not have access to this report.',
  pollErrorTitle: 'Could not load report',
  pollErrorBody: 'Something went wrong while loading this report. Try again in a moment.',
  timeout:
    'This check took longer than expected and was stopped. Please try again.',
  generic:
    "We couldn't complete this check. The site may be unreachable or blocking automated visits.",
  scannerUnavailable:
    'Our scanner is temporarily unavailable. Please try again in a few minutes.',
  captureFailed: 'We could not capture a screenshot of this page. Check that the URL is public and loads in a browser.',
  siteBlocked: 'This site blocked our automated visit. Try again later or check from a public URL.',
  rateLimited: 'This site is rate-limiting requests. Try again in a few minutes.',
  unreachable: 'We could not reach this page. Check the URL and try again.',
  notHtml: 'This URL did not return a normal web page. Check the link and try again.',
  aiReviewFailed: 'AI review could not finish for this check. Please try again.',
  partialAiReview: 'AI review could not finish. Deterministic checks are shown below.',
  partialReport: 'This report is partial. Some checks or screenshots could not complete.',
  pageSpeedUnavailable: 'PageSpeed data was unavailable for this run.',
} as const

export const AUDIT_PROGRESS = {
  inProgress: 'Scanning your site...',
  submitLoading: 'Scanning…',
  bannerScanning: 'Scanning',
  workerQueuedWarningDev:
    'Report is still preparing. In local dev, run npm run dev:all so the worker processes jobs.',
  workerQueuedWarningProd:
    'Scan workers are restarting. Your report will continue automatically.',
  workerBacklogWarningProd:
    'Still preparing your report. It will continue shortly.',
  stages: [
    { status: 'QUEUED', label: 'Starting check', subtitle: 'Preparing your review...' },
    { status: 'CAPTURING', label: 'Capturing screenshots', subtitle: 'Desktop and mobile views...' },
    { status: 'CHECKING', label: 'Running checks', subtitle: 'Message, Experience, Reach...' },
    { status: 'JUDGING', label: 'AI review', subtitle: 'Turning issues into Flags and fix prompts...' },
    { status: 'FINALIZING', label: 'Preparing review', subtitle: 'Scoring rubrics and packaging results...' },
  ],
  stageActivity: {
    QUEUED: ['Preparing your report...', 'Spinning up the pipeline...'],
    CAPTURING: [
      'Capturing desktop screenshot...',
      'Capturing mobile screenshot...',
      'Testing primary CTA click-through...',
      'Loading page in browser...',
    ],
    CHECKING: [
      'Reviewing message clarity and CTA copy...',
      'Checking layout, mobile viewport, and tap targets...',
      'Scanning share preview tags and metadata...',
      'Measuring load speed and Core Web Vitals...',
      'Reviewing trust signals like HTTPS and privacy links...',
      'Looking for broken interactions and console errors...',
    ],
    JUDGING: [
      'AI is analyzing screenshots and evidence...',
      'Generating agent-ready fix prompts...',
      'Prioritizing Flags by launch impact...',
    ],
    FINALIZING: ['Packaging your review...', 'Scoring all 3 rubrics...', 'Almost ready...'],
  },
} as const

export const SEO = {
  home: {
    title: 'FixFlags - Finish what your AI started',
    description:
      'Paste a URL. FixFlags finds what your AI editor missed: message gaps, UX issues, missing metadata. With fix prompts your agent can run. Free check.',
  },
  pricing: {
    title: 'Pricing',
    description:
      'Start free with the full report and 3 checks. Upgrade to Pro for unlimited monitoring and MCP. Founding pricing for early users.',
  },
  howItWorks: {
    title: 'How FixFlags Works',
    description:
      'Run FixFlags from the website or through MCP in Cursor, Claude Code, and Windsurf. Find Flags, copy fix prompts, and monitor shipped changes.',
  },
  samples: {
    title: 'Sample Report',
    description:
      'See a real FixFlags report of our LaunchPad demo landing page: evidence-backed Flags with copy-ready fix prompts.',
  },
  examples: {
    title: 'Example Reports',
    description:
      'Automated FixFlags checks of recognizable sites like web.dev, Vercel, and Wikipedia. Illustrative, not endorsements.',
  },
  mcp: {
    title: 'MCP Integration',
    description:
      'Connect FixFlags to Cursor, Claude Code, or Windsurf. Check and fix your site without leaving your editor.',
  },
  faq: {
    title: 'FAQ',
    description:
      'Answers about FixFlags checks, Flags, fix prompts, free vs paid plans, MCP integration, and who it\u2019s for.',
  },
  changelog: {
    title: 'Changelog',
    description: 'Product updates, new checks, and shipping improvements for FixFlags.',
  },
  metaPreview: {
    title: 'Meta Preview Tool – FixFlags',
    description:
      'See how your page looks when shared on Slack, X, LinkedIn, and Discord. Check og:image, title, and description tags on any URL. Free tool.',
  },
  placeholderDetector: {
    title: 'Placeholder Copy Detector – FixFlags',
    description:
      'Scan any URL for Lorem ipsum, TODO markers, AI-builder template artifacts, and unreplaced tokens. Free tool.',
  },
  blog: {
    title: 'Blog',
    description: 'Notes on shipping AI-built products without the embarrassing bugs — QA, launch checklists, and what breaks when you ship fast.',
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How FixFlags collects and uses your data.',
  },
  terms: {
    title: 'Terms of Service',
    description: 'Terms for using FixFlags.',
  },
} as const

export const MARKETING_ILLUSTRATION_PROMPTS = {
  hero: 'Minimal editorial SaaS hero: browser window with Flag list and fix prompt snippet, warm neutral palette, no text labels.',
  steps: 'Three-step horizontal flow: URL check, clipboard fix prompt, monitoring with cleared Flags, flat vector, muted ochre accent.',
  proof: 'Split panel: website screenshot with highlighted Flags and copy-ready prompt card, calm dark UI, product marketing style.',
} as const
