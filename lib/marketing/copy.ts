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
  fixPrompt: 'Fix prompt',
  seeFullSample: 'See full sample report',
  nextStep: 'Paste into editor → run → re-check.',
} as const

export const TOOLS = {
  metaPreview: {
    badge: 'Free Tool',
    heading: 'Meta Preview Tool',
    subhead:
      'See how your page looks when shared on Slack, X, LinkedIn, and Discord. Enter a URL to check its og:image, title, and description tags.',
    ctaCheck: 'Check preview',
    ctaAudit: 'Run full audit on this URL',
    socialPreviewHeading: 'Social Preview',
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
  headlineAccentLegacy: false,
  subhead:
    'Code review checks syntax. FixFlags checks messaging, experience, and reach. So what you ship actually works.',
  primaryCta: 'Review my site',
  navSignUpCta: 'Try free',
  trySampleCta: 'View sample report',
  trySampleHint: 'Demo site. No account needed.',
  urlPlaceholder: 'your-site.com',
  trustBadgesSubtitle: 'See what users see',
  trustBadges: [
    'See what users see',
    'Fix prompts after signup',
    'Evidence & screenshots',
    'Free to try',
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
    'Flags with evidence, impact, and fix prompts',
    'A re-check loop to prove fixes landed',
  ],
  isNot: [
    'Not a generic Lighthouse wrapper',
    'Not manual QA-as-a-service',
    'Not an enterprise test suite',
  ],
  bullets: [
    'AI reads screenshots for message, experience, and reach gaps',
    'Every Flag ships with a fix prompt',
    'Re-checks prove fixes landed',
  ],
  rows: [
    { feature: 'Says why each Flag hurts conversion', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'AI reads screenshots for UX gaps', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Identifies missing og:image', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Checks mobile CTA placement', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', fixflags: 'Yes' },
    { feature: 'Re-check after fixes', lighthouse: 'Manual', manual: 'Manual', fixflags: 'Built-in' },
    { feature: 'Before/after comparison', lighthouse: 'No', manual: 'No', fixflags: 'Yes (Pro)' },
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

export const CASE_STUDIES_SECTION = {
  label: 'Re-check results',
  headline: 'Fixes that clear Flags',
  subhead: 'Illustrative results after applying fix prompts and running a re-check.',
} as const

export const PROOF_SECTION = {
  label: OUTPUT_LABELS.whatYouGet,
  headline: 'Flags, screenshots, and fix prompts',
  subhead:
    'Real output from a public URL. Copy a fix prompt, paste it into your editor, then re-check to prove the fix.',
  nextStep: OUTPUT_LABELS.nextStep,
  cta: 'Check My Site',
  sample: {
    name: 'PlantDad',
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
    description: 'Flow scan could not run during this audit. Run a new check to try again.',
  },
  timeout: {
    label: 'Timed out',
    description: 'Flow scan exceeded the time limit before completing the click-through.',
  },
} as const

export const FLAG_STATUS_LABELS = {
  OPEN: { label: 'Open', description: 'Not fixed yet' },
  FIXED: { label: 'Fixed', description: 'Cleared on a re-check' },
  IGNORED: { label: 'Ignored', description: 'Acknowledged and skipped' },
  REGRESSED: { label: 'Regressed', description: 'Same issue, worse than before' },
} as const

export const RECHECK_DIFF_COPY = {
  title: 'Re-check results',
  cleared: 'Cleared',
  remaining: 'Still open',
  newIssues: 'New',
  regressed: 'Regressed',
  empty: 'No flag changes on this re-check.',
  compareCta: 'Open full before/after',
  compareProHint: 'Want side-by-side screenshots?',
  compareProCta: 'See Pro compare',
} as const

export const PRODUCT_LADDER = {
  headline: 'Start free. Upgrade when you ship weekly.',
  steps: [
    {
      plan: 'FREE',
      title: 'Check',
      body: 'Score, Flags, evidence, and screenshots. Free account for fix prompts. Three AI reports total.',
    },
    {
      plan: 'BUILDER',
      title: 'Prove',
      body: 'Before/after comparison, 25 new checks per month, and MCP in your editor.',
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
Claude: calls ff_monitoring
Claude: "Experience improved from Needs Attention → Pass. Two Flags cleared."`,
} as const

export const HOW_IT_WORKS_PAGE = {
  hero: {
    eyebrow: 'How FixFlags works',
    headline: 'Check your site from the browser or your coding agent.',
    subhead:
      'Paste a URL for an instant report. Or connect MCP and let Cursor, Claude Code, or Windsurf find Flags, apply the fixes, and re-check the page.',
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
        'Re-check after the agent applies changes',
      ],
      cta: 'View MCP setup',
      href: '/docs/mcp',
    },
  ],
  reportPreview: {
    label: 'What the report gives you',
    title: 'A fix queue, not a score dump.',
    body: 'Each Flag explains what broke, where we saw it, why it matters, and what to paste into your builder.',
    rubricLine:
      'Message is what the page says. Experience is how it works. Reach is how people find and share it.',
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
        body: 'FixFlags loads the page like a user, captures evidence, and scores Message, Experience, and Reach.',
      },
      {
        title: 'Send the fix to your builder',
        body: 'Copy the prompt manually or let MCP hand the exact Flag to your coding agent.',
      },
      {
        title: 'Re-check the shipped change',
        body: 'Run the same URL again and keep the history in your dashboard.',
      },
    ],
  },
  mcp: {
    label: 'MCP workflow',
    title: 'Your agent reads the same report you do.',
    body: 'MCP is the open standard that lets coding agents call outside tools. Connect FixFlags and site QA becomes part of the coding loop instead of a separate tab.',
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

export const FINAL_CTA = {
  headline: 'Paste your URL.',
  headlineAccent: 'See what to fix.',
  body: 'Your first scan is free, no account needed. Create a free account for fix prompts, then re-check after you ship.',
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
    title: 'Why AI-built sites still need a final review',
    date: '2026-07-02',
    excerpt:
      'AI coding tools ship fast, but speed skips the boring checks: dead CTAs, broken previews, missing alt text. Here is why a final review matters before you share the link.',
    body: [
      'AI coding tools are very good at producing a page that looks finished. They are much less good at noticing the things that only show up when someone else actually uses the page: a call-to-action that points nowhere, an Open Graph image that never loads, a form input with no label.',
      'None of these are hard to fix. Almost all of them are invisible until a real user, or a QA pass, goes looking.',
      'That gap is what "finish what your AI started" means in practice. The build gets you 90% of the way. The last 10% is the pass that catches what speed skipped, and it is exactly the kind of checklist work that is easy to automate and easy to skip when you are moving fast.',
      'The final review can be systematic: run the checks, get the Flags, fix what matters, then re-check. That loop is the habit.',
    ],
  },
] as const

export const LANDING_PAGE = {
  logoCloud: {
    label: 'Copy fix prompts into',
    disclaimer: '',
    logos: ['Cursor', 'Codex', 'Lovable', 'Bolt', 'Claude Code', 'Windsurf'] as const,
  },
  checkDimensions: {
    label: '',
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
          evidence: '"Your team deserves better naps"',
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
      'Paste a URL. Get Flags and fix prompts. Re-check after you ship fixes.',
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
        title: 'Re-check',
        body: 'Run the same URL to see which Flags cleared.',
        preview: 'Re-check complete',
        previewBadge: 'Improved',
      },
    ] as const,
  },
  testimonials: {
    headline: 'What builders catch before launch',
    subhead: 'Small misses become obvious once the page gets a proper review.',
    disclaimer: '',
    cardLabel: 'Example finding',
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
    label: '',
    headline: 'A review your AI agent can act on.',
    body: 'Each flag includes evidence, business impact, and the exact fix. No noise. Just what matters.',
    cta: 'View full sample review',
    illustrativeLabel: '',
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
      'No. Your first scan is free, no account needed. You see the score, verdict, and Flags right away. Create a free account for fix prompts, saved report history, and 3 AI reports.',
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
      'Each Flag includes a fix prompt with specific evidence from your page. Paste it into your AI agent and it knows exactly what to fix. With MCP, your agent fetches prompts automatically.',
  },
  {
    question: 'Can I re-check after my agent fixes issues?',
    answer:
      'Yes. All registered users can re-check reports they own as often as needed. Re-checks do not count against your new-URL limit. Pro adds before/after compare and MCP in your editor.',
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

export const PRICING_FAQ = [
  {
    question: 'Can I start free and upgrade later?',
    answer:
      'Yes. Your first scan is free without an account. Create a free account for fix prompts, 3 AI reports, and unlimited re-checks, then upgrade for more new checks, compare, and MCP.',
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
      'Every plan includes Flags with evidence, fix prompts after you create an account, and unlimited re-checks. Paid plans add more new checks, before/after compare, MCP, and team features.',
  },
] as const

export const PRICING = {
  headline: 'Start free. Pay when you ship.',
  subhead:
    'Start free with Flags, evidence, and unlimited re-checks. Create an account for fix prompts. Upgrade for more new checks, before/after compare, and MCP.',
  trustBadge: 'Unlimited re-checks on every plan',
  upgradeSteps: 'Create account → Stripe checkout → Dashboard',
  upgradeStepsLoggedIn: 'Stripe checkout → Dashboard',
  allPlansInclude:
    'Every check includes evidence and rubric summaries. Fix prompts come with a free account. Re-checks stay free. Pro adds compare, more new checks, and MCP.',
} as const

export const PLANS = getMarketingPlans()

export const REPORT_COPY = {
  recheck: {
    label: 'Re-check',
    error: 'Could not start the re-check. Try again.',
  },
  launchGates: {
    title: 'Launch gates',
    body: 'Five concrete checks from your report evidence. Fix any failed gates before you ship.',
  },
  recheckHint: {
    title: 'Next: prove your fixes worked',
    bodyPrefix: 'Paste the fix prompts into your editor, ship the changes, then select',
    bodySuffix: 'above to see which Flags cleared.',
  },
  sampleCta: {
    title: 'Run the same check on your site',
    body: 'Paste a URL. See Flags across three rubrics and fix prompts for your agent.',
  },
  noFlags: {
    title: 'No flags found',
    body: 'This scan did not surface any issues. Nice work.',
  },
  aiPending: {
    title: 'Fix prompts generating',
    body: 'Generating copy-paste fix prompts for every flag. This usually takes under a minute.',
  },
  partialReport: {
    title: 'Partial report',
    body: 'Some optional evidence was unavailable. Unassessed rubrics remain ungraded rather than being inferred.',
  },
  captureLimited: {
    title: 'Limited screenshots',
    body: 'We could only capture a limited view of this page. Flags still reflect what we could verify.',
  },
  capturePartial: {
    title: 'Partial screenshots',
    body: 'Desktop or mobile capture was incomplete. Some visual evidence may be missing.',
  },
  pageSpeedPartial: {
    title: 'PageSpeed incomplete',
    body: 'PageSpeed data was unavailable for this run. Experience flags that need it may be thinner.',
  },
  sectionTitles: {
    topPriorities: 'Top priorities',
    topPrioritiesHint: 'Paste into Cursor, Claude Code, or any editor with plan mode to get a structured fix plan before editing.',
    summaryByRubric: 'Summary by rubric',
  },
  explorer: {
    allSeverities: 'All severities',
    allPages: 'All Pages',
    noMatchFilter: 'No flags match this filter.',
    checkingIssues: 'Checking for issues…',
    selectFlag: 'Select a flag to see evidence and the fix prompt.',
    flagsAppear: 'Flags appear here as the scan finishes.',
    stillScanning: 'Still scanning this page',
    scanning: 'Scanning',
    scanned: 'Scanned',
    noFlagsNice: 'No flags. Nice work.',
  },
  runYourOwnAudit: 'Run your own audit',
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
      BUILDER: 'You\u2019re signing up for Pro, with 25 monthly checks, compare, and MCP from day one',
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
    { icon: 'monitoring' as const, text: 'Re-check after fixes to see what cleared' },
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
    headline: 'Get copy-paste fix prompts',
    body: 'You already see your score, Flags, and evidence. Create a free account for the fix prompts, save this report, and re-check after you ship.',
    primaryCta: 'Create free account',
    secondaryCta: 'See paid plans',
  },
  signedInAiPending: {
    headline: 'Fix prompts on the way',
    body: 'Deterministic fixes are ready below. Enhanced copy-paste prompts usually finish within a minute.',
  },
  signedInAiDegraded: {
    headline: 'Deterministic fixes are ready',
    body: 'AI summary did not finish for this run. You still have evidence and fix steps for every Flag below. Re-check to retry the AI pass.',
  },
  atLimit: 'AI report limit reached. Upgrade to continue',
} as const

export const FLAG_FEEDBACK_COPY = {
  thanksUp: 'Thanks for the feedback!',
  thanksDown: "Got it, we'll improve this.",
  saveFailed: 'Failed to save feedback',
} as const

export const FIRST_AUDIT_PROMPT = {
  headline: 'Paste the URL you are about to share.',
  body: 'FixFlags reviews your page before anyone else sees it. You get Flags across Message, Experience, and Reach with evidence. Create a free account for fix prompts ready to paste into Cursor, Claude, Lovable, or Bolt.',
  examplesLabel: 'Common first checks',
  examples: [
    { label: 'Your Product Hunt page', hint: 'producthunt.com/posts/your-product' },
    { label: 'Your demo day landing page', hint: 'yourstartup.com' },
    { label: 'A client site before handoff', hint: 'clientsite.com' },
  ],
  footerPrefix: 'Not sure what to check first?',
  footerLink: 'See a sample report',
  footerSuffix: 'to know what you will get.',
} as const

export const PROJECT_ASSIGN_COPY = {
  assigned: 'Assigned to project',
  removed: 'Removed from project',
  updateFailed: 'Could not update the project. Try again.',
  loadFailed: 'Could not load projects. Try refreshing the page.',
} as const

export const SHARE_COPY = {
  privateTitle: 'Private report',
  privateBody: 'This link only works for you while signed in. Upgrade to Agency for public share links anyone can open.',
  privateLinkCta: 'Copy private link',
  privateLinkCopied: 'Private link copied',
  privateLinkCopiedDetail: 'This link only works for you while signed in.',
  agencyCta: 'Agency',
} as const

export const ANON_CLAIM_GUIDE = {
  headline: 'Get fix prompts for these Flags',
  body: 'You can already see the evidence. Create a free account to claim this report, copy fix prompts into your editor, and re-check when you ship. Re-checks stay free.',
  primaryCta: 'Create free account',
  steps: [
    'Create an account to claim this report',
    'Copy a fix prompt into your editor',
    'Re-check to see which Flags cleared',
  ],
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You\u2019ve used your 3 AI reports',
    body: 'Deterministic checks and unlimited re-checks still work. Upgrade to Pro for 25 AI reports per month, before/after compare, and MCP in Cursor or Claude.',
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
    body: 'Pro adds 25 new checks per month, before/after compare, and MCP so checks run inside Cursor or Claude.',
    cta: proUpgradeCta(),
    plan: 'BUILDER' as const,
  },
  report_completed: {
    headline: 'Automate the report loop',
    body: 'Pro adds 25 new checks each month, before/after proof, and MCP in Cursor or Claude.',
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
  triageDegradedAnonymous:
    'Automated checks are complete. AI summary was unavailable for this run. Sign up to retry with full AI review and fix prompts.',
  triageDegradedSignedIn:
    'Automated checks are complete. AI summary was unavailable for this run. Deterministic flags and screenshots are shown below.',
  triageDegradedTimeout:
    'This scan ran out of time before AI summary could finish. Deterministic checks and screenshots are shown below.',
  triageProviderNotConfigured:
    'AI summary is unavailable because no provider key is configured on the scanner. Deterministic checks and fix steps are shown below.',
  partialReport: 'Some optional evidence was unavailable. Unassessed rubrics remain ungraded rather than being inferred.',
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

export function formatQueueWaitHint(seconds: number): string {
  if (seconds >= 60) {
    return `About ${Math.ceil(seconds / 60)} min before the scan starts.`
  }
  return `About ${Math.max(1, Math.round(seconds))}s before the scan starts.`
}

export const SEO = {
  home: {
    title: 'FixFlags - Finish what your AI started',
    description:
      'Paste a URL. FixFlags finds what your AI editor missed: message gaps, UX issues, missing metadata. With fix prompts your agent can run. Free check.',
  },
  pricing: {
    title: 'Pricing',
    description:
      'Start free with the full report, 3 AI checks, and unlimited re-checks. Pro adds 25 new checks per month, compare, and MCP.',
  },
  howItWorks: {
    title: 'How FixFlags Works',
    description:
      'Run FixFlags from the website or through MCP in Cursor, Claude Code, and Windsurf. Find Flags, copy fix prompts, and re-check shipped changes.',
  },
  samples: {
    title: 'Sample Report',
    description:
      'See a real FixFlags report of our PlantDad demo landing page: evidence-backed Flags with fix prompts.',
  },
  examples: {
    title: 'Example Reports',
    description:
      'Automated FixFlags checks of recognizable sites like web.dev, Vercel, and Wikipedia.',
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
    description: 'Notes on shipping AI-built products without the embarrassing bugs. QA, launch checklists, and what breaks when you ship fast.',
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
