/**
 * FixFlags marketing copy. Single source of truth.
 *
 * Voice: sharp senior reviewer. Clear, calm, direct. No hype.
 * Do: short sentences, verb-first CTAs, name tools, lead with what to fix.
 * Don't: comprehensive, robust, leverage, unlock, 10x; over-promise free tier.
 */

import { getMarketingPlans, proUpgradeCta, EXPERT_REVIEW_PRICE_USD } from '@/lib/billing/plans'

export const BRAND = {
  name: 'FixFlags',
  domain: 'fixflags.com',
  tagline: 'Your AI built it. FixFlags shows what to fix.',
  category: 'FixFlags finishes what your AI started.',
  oneLiner: 'Your AI shipped a site. FixFlags finds what it missed, with fix prompts your agent can run.',
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
  nextStep: 'Paste into editor → run → re-check.',
} as const

export const HERO = {
  badge: 'Finish what your AI started.',
  headline: 'Finish what your AI started.',
  headlineLine1: 'what your',
  headlineLine2: 'AI started.',
  headlineAccent: 'Finish',
  audienceLine: 'Second pass for AI-built sites.',
  headlineAccentLegacy: false,
  subhead:
    'Paste a URL. FixFlags finds what your AI editor missed: message gaps, UX issues, missing metadata. With fix prompts your agent can run.',
  trustLine: 'Run a second pass before users see it.',
  supportingLine: 'Run a second pass before users see it.',
  primaryCta: 'Show fixes',
  navSignUpCta: 'Sign up',
  trySampleCta: 'Try sample URL',
  urlPlaceholder: 'your-site.com',
  trustBadges: [
    'See what users see',
    'Copy-ready fix prompts',
    '3 Free Scans',
  ] as const,
  samplePreviewCue: 'Live sample from our demo site. Use the arrows to browse 7 real flags.',
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
  headline: 'Check, fix, prove',
  subhead: 'Three steps: check, fix, re-check.',
  steps: [
    {
      step: 1,
      title: 'Check',
      body: 'Paste a URL. Get Flags across Message, Experience, and Reach with desktop and mobile screenshots.',
    },
    {
      step: 2,
      title: 'Fix',
      body: `Copy-ready prompts for ${AI_TOOLS}. Paste into your editor or repo and ship fixes.`,
    },
    {
      step: 3,
      title: 'Re-check',
      body: 'Run a second pass on the same URL to confirm Flags cleared.',
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
    title: 'Re-check',
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
    'The second pass that finishes what your AI started',
    'Flags with evidence, impact, and copy-ready fix prompts',
    'Re-check loop to prove fixes landed',
  ],
  isNot: [
    'Not a generic Lighthouse wrapper',
    'Not manual QA-as-a-service',
    'Not an enterprise test suite',
  ],
  bullets: [
    'AI reads screenshots for message, experience, and reach gaps',
    'Every Flag ships with a copy-ready fix prompt',
    'Re-check proves fixes landed (Pro)',
  ],
  rows: [
    { feature: 'Says why each Flag hurts conversion', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'AI reads screenshots for UX gaps', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Identifies missing og:image', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Checks mobile CTA placement', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', fixflags: 'Yes' },
    { feature: 'Re-check after fixes', lighthouse: 'Manual', manual: 'Manual', fixflags: 'Built-in' },
    { feature: 'Re-check proof loop', lighthouse: 'No', manual: 'No', fixflags: 'Yes (Pro)' },
    { feature: 'Public share links for clients', lighthouse: 'No', manual: 'No', fixflags: 'Yes (Max)' },
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
  label: 'Re-check',
  headline: 'Fixes that clear Flags',
  subhead: 'Illustrative re-checks after applying fix prompts.',
} as const

export const PROOF_SECTION = {
  label: OUTPUT_LABELS.whatYouGet,
  headline: 'Flags, screenshots, and fix prompts',
  subhead:
    'Real output from a public URL. Copy a fix prompt, paste it into your editor, then re-check to prove the fix.',
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
    description: 'Flow scan could not run during this audit. Try a full re-check.',
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
  FIXED: { label: 'Fixed', description: 'Resolved in a re-check' },
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
      body: 'Unlimited re-checks, before/after compare, and MCP in your editor.',
    },
    {
      plan: 'TEAM',
      title: 'Share',
      body: 'Client share links, proof exports, and projects for power users and teams.',
    },
  ],
} as const

export const MCP_SECTION = {
  headline: 'Run checks from your editor',
  body: 'Connect via MCP so your agent finds Flags, fixes them, and re-checks without copy-pasting URLs.',
  intro: 'A typical prompt sequence looks like this:',
  closing: 'Then re-check to prove the improvement.',
  cta: 'See MCP setup',
  workflow: `User: "Check https://myapp.com and review the Experience rubric"

Claude calls: ff_check_url → ff_get_rubric("EXPERIENCE")
Claude: "Experience needs attention. Two Flags:
  - Primary CTA is below fold on 375px screens
  - 3 buttons with tap targets under 40px
  Should I apply fixes now?"
User: "Yes"
Claude: applies fixes
Claude: calls ff_recheck
Claude: "Experience improved from Needs Attention → Pass. Two Flags cleared."`,
} as const

const PRICING_TEASER_BULLETS: Record<'FREE' | 'BUILDER' | 'TEAM', readonly string[]> = {
  FREE: ['Unlimited re-checks on your reports', 'No share links', 'No export'],
  BUILDER: ['Re-check loop', 'Before/after compare', 'Editor integration (MCP)'],
  TEAM: ['Public share links', 'Proof exports', 'Up to 5 projects'],
}

export const PRICING_TEASER = {
  headline: PRODUCT_LADDER.headline,
  subhead: 'Full report on every plan. Pro adds unlimited re-checks and MCP in your editor.',
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
  body: 'Run a free check on any live or preview URL. Every finding includes evidence and a fix prompt your editor can run.',
} as const

export const CHANGELOG_ENTRIES = [
  {
    date: '2026-06-20',
    title: 'Sample report uses a demo landing page',
    items: [
      'The sample report now audits a fictional startup landing page instead of our marketing homepage',
      'Try the sample URL to see a realistic first-pass review on a typical AI-built page',
    ],
  },
  {
    date: '2026-06-18',
    title: 'Track MCP usage from your dashboard',
    items: [
      'See call volume, success rate, and tool breakdown on the new MCP Analytics page',
      'Review recent failures to debug editor connection issues faster',
    ],
  },
  {
    date: '2026-06-15',
    title: 'FixFlags is now in open beta',
    items: [
      'Sign up and create your account to start testing your sites',
      'Run free checks on any live or preview URL',
      'Get results across Message, Experience, and Reach with Pass / Needs Attention / Blocked status',
      "We'd love your feedback - use the chat button to tell us what you think",
    ],
  },
  {
    date: '2026-06-01',
    title: 'Check your URLs from Cursor and Claude Code',
    items: [
      'Run FixFlags checks directly from your editor without leaving your workflow',
      'Fetch fix prompts and verify your fixes landed - all from your terminal',
    ],
  },
  {
    date: '2026-05-15',
    title: 'Agent-ready fix prompts on every flag',
    items: [
      'Copy-ready fixes with evidence and verification rules for each issue found',
      'Desktop and mobile screenshots included on every check result',
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
      'Paste a URL. Get findings and fix prompts. Re-check when you ship fixes.',
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
        body: 'We re-check and show what improved.',
        preview: 'Re-check complete',
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
    madeWith: 'Made with \u2764\ufe0f by the FixFlags team',
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
      'No, on the homepage or any shared report. Run unlimited deterministic checks without an account. Sign up for 3 AI reports with fix prompts and saved history.',
  },
  {
    question: 'What\u2019s included in the free plan vs Pro?',
    answer:
      'Free: unlimited deterministic checks, 3 AI reports with fix prompts, and unlimited re-checks on reports you own. Pro: before/after compare, MCP in Cursor or Claude, and 25 new checks per month.',
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
    question: 'Can I re-check after my agent fixes issues?',
    answer:
      'All registered users can re-check reports they own as often as needed. Re-checks do not count against your new-URL limit. Pro adds before/after compare and MCP in your editor.',
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
      'Builders and small teams shipping with AI tools like Cursor, Lovable, and Bolt. Run a second pass before users see the link. Not built for enterprise QA teams running manual test suites.',
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
      'Yes. Run unlimited deterministic checks without an account. Sign up for 3 AI reports with fix prompts, then upgrade to Pro when you need unlimited re-checks and MCP.',
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
      'Every plan includes the full report and copy-ready fix prompts. Paid plans add unlimited re-checks, MCP, higher check volume, and team features.',
  },
] as const

export const PRICING = {
  headline: 'Pay when you\u2019re shipping, not when you\u2019re browsing',
  subhead:
    'Start free with the full report. Upgrade when you ship weekly and need unlimited re-checks and MCP.',
  foundingBadge: 'Founding offer active: lock in launch-week pricing',
  upgradeSteps: 'Create account → Stripe checkout → Dashboard',
  expertReview: {
    title: `Expert Review - $${EXPERT_REVIEW_PRICE_USD}`,
    body: 'A human reviews your report and writes a prioritized fix plan. Good for launch week.',
    steps: [
      'Submit your latest FixFlags report',
      'A senior reviewer prioritizes Flags by launch impact',
      'Get a launch checklist within 48 hours',
    ],
    cta: 'Get Expert Review',
  },
  allPlansInclude:
    'Every check includes evidence, fix prompts, and rubric summaries. Pro adds the ship loop: re-check, compare, and check from your editor.',
} as const

export const PLANS = getMarketingPlans()

export const SAMPLES_PAGE = {
  subhead: 'This is what a completed FixFlags report looks like: full report, all Flags.',
  tierNote: 'Free includes the full report. Pro adds unlimited re-checks and MCP in your editor.',
} as const

export const REPORT_COPY = {
  launchGates: {
    title: 'Launch gates',
    body: 'Five concrete checks from your report evidence. Fix any failed gates before you ship.',
  },
  recheckHint: {
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
    { name: 'ff_recheck', desc: 'Run a new check on the same URL to verify fixes.' },
    {
      name: 'ff_compare',
      desc: 'Compare two reports: see what improved, stayed the same, or regressed.',
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
      BUILDER: 'You\u2019re signing up for Pro, unlimited re-checks and MCP from day one',
      TEAM: 'You\u2019re signing up for Max, organize checks across up to 5 projects',
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
    { icon: 'recheck' as const, text: 'Re-check after fixes to track improvement' },
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
    headline: 'Unlock AI review',
    body: 'Create a free account to see fix prompts, rubric analysis, and the full AI review on this report.',
    primaryCta: 'Create free account',
    secondaryCta: 'See paid plans',
  },
  atLimit: 'AI report limit reached. Upgrade to continue',
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You\u2019ve used your 3 AI reports',
    body: 'Upgrade to Pro for 25 checks per month, unlimited re-checks, and MCP in Cursor or Claude.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  compare_improved: {
    headline: (scoreDelta: number) =>
      `Score improved ${scoreDelta > 0 ? `+${scoreDelta}` : ''}`.trim(),
    body: 'Keep proving every ship with unlimited re-checks and MCP in Cursor.',
    cta: proUpgradeCta('Start Pro'),
    plan: 'BUILDER' as const,
  },
  compare_flat: {
    headline: 'Still Flags after your re-check',
    body: 'Pro gives unlimited re-checks and MCP so your agent can close what remains without copy-pasting URLs.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  share_public: {
    headline: 'Share reports with clients',
    body: 'Max includes public share links with OG previews and a Check My Site CTA for viewers.',
    cta: 'Upgrade to Max',
    plan: 'TEAM' as const,
  },
  export_locked: {
    headline: 'Proof exports are on Max',
    body: 'Copy a client-ready summary with rubrics and top Flags. Upgrade to Max to unlock exports.',
    cta: 'Upgrade to Max',
    plan: 'TEAM' as const,
  },
  free_default: {
    headline: 'Ship weekly? Automate the loop',
    body: 'Pro adds unlimited re-checks, before/after compare, and MCP so checks run inside Cursor or Claude.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Unlock full report history and automation',
    body: 'Pro adds unlimited re-checks, before/after proof, MCP in Cursor or Claude, and saved report history.',
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
      'Start free with the full report and 3 checks. Upgrade to Pro for unlimited re-checks and MCP. Founding offer active.',
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
  steps: 'Three-step horizontal flow: URL check, clipboard fix prompt, re-check with cleared Flags, flat vector, muted ochre accent.',
  proof: 'Split panel: website screenshot with highlighted Flags and copy-ready prompt card, calm dark UI, product marketing style.',
} as const
