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
  category: 'Release readiness for AI-built products.',
  oneLiner: 'FixFlags is the release readiness layer for AI-built products.',
  supportEmail: 'hello@fixflags.com',
  mcpServerKey: 'fixflags',
  exportPrefix: 'FixFlags Report',
  tribeBadge: 'Finish what your AI started',
} as const

export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://fixflags.com'

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

export const ROAST_COPY = {
  title: 'Website Roast',
  subhead: 'Paste your URL. Get roasted. Fix what matters.',
  placeholder: 'https://your-site.com',
  cta: 'Roast it',
  ctaLoading: 'Roasting...',
  overallLabel: 'Overall Quality',
  topIssuesHeading: 'Top issues',
  shareBadge: 'Share your quality badge',
  downloadSvg: 'Download SVG',
  copyMarkdown: 'Copy markdown',
  fullReport: 'Full report',
  wantFixes: 'Want fix prompts for every issue?',
  runFullAudit: 'Run full FixFlags audit',
  taglines: {
    A: 'Ship it. This is ready for humans.',
    B: 'Solid foundation. A few tweaks and you are golden.',
    C: 'Not bad, but your users will notice.',
    D: 'Your site has feelings. Mostly pain.',
    F: 'We roasted your site so your users do not have to.',
    default: 'Every site has room to grow.',
  },
  rubricVerdicts: {
    MESSAGE: {
      A: 'Clear, focused, conversion-ready.',
      B: 'Good messaging. Minor clarity gaps.',
      C: 'Visitors understand what you do. Eventually.',
      D: 'Your headline is working against you.',
      F: 'Visitors have no idea what this is about.',
    },
    EXPERIENCE: {
      A: 'Fast, accessible, and broken nothing.',
      B: 'Works well. A few rough edges.',
      C: 'It loads. That is about the nicest thing we can say.',
      D: 'Your users are leaving. We can see why.',
      F: 'This is a usability incident.',
    },
    REACH: {
      A: 'Google will find you. So will everyone else.',
      B: 'SEO is solid. A few meta gaps.',
      C: 'You exist on the internet. Technically.',
      D: 'Your SEO is actively hiding you.',
      F: 'You are invisible to search engines.',
    },
  },
} as const

/** Canonical free-tier offer. Wire every surface from here; do not paraphrase. */
export const OFFER = {
  line: 'Free check. See what\u2019s broken. Sign up when you want the fix prompts and re-check.',
  short: 'Free check. See what\u2019s broken before you share the link.',
  /** Privacy page / FAQ only. Do not render on marketing heroes. */
  privacy: 'We scan your live URL. We do not change your site or touch your code.',
  linkPrivacy:
    'Owned reports are private to your account. Anonymous scans stay on a private link until you sign in and save them.',
} as const

/** User-facing score explanation. Must match lib/audit/checks/rubric.ts + scoring.ts. */
export const SCORE_HELP = {
  short:
    'Score starts at 100 and drops based on the number and severity of unresolved flags across Message, Experience, and Reach.',
  detail:
    'Each rubric starts at 100. Critical flags subtract more than Important, which subtract more than Polish. The overall score weights Experience highest, then Message, then Reach. Experience may also blend in PageSpeed when available.',
  /** Canonical deep link: keep in sync with lib/help scores-and-severity */
  faqHref: '/help/checks-and-reports/scores-and-severity',
} as const

/** Help Center chrome. Article bodies live in lib/help/catalog.ts. */
export const HELP_CENTER = {
  label: 'Help Center',
  title: 'How can we help?',
  subhead: 'Search guides for checks, billing, MCP, and your account. Still stuck? Chat with us.',
  searchPlaceholder: 'Search help articles…',
  categoriesHeading: 'Browse by topic',
  popularHeading: 'Popular articles',
  noResults: 'No articles match that search. Try another phrase or open chat.',
  stillStuck: 'Still stuck?',
  openChatCta: 'Open chat',
  emailCta: 'Email us',
  relatedHeading: 'Related articles',
  backToHelp: 'Back to Help Center',
  mcpGuideCta: 'Open full MCP guide',
  askSupportCta: 'Ask support',
  viewHelpCta: 'View help article',
} as const

/** Live chat widget + welcome SYSTEM message (must match lib/help/sla.ts). */
export const SUPPORT_CHAT = {
  title: 'Chat with FixFlags',
  subtitle: 'We typically reply within a few hours',
  emptyState: 'Ask us anything about FixFlags, your audit, or getting started.',
  startError: 'Could not start chat. Try again in a moment.',
  welcomeMessage:
    "You're chatting with the FixFlags team. We typically reply within a few hours.",
  prefillPrefix: 'I need help with:',
  ariaOpen: 'Open live chat',
  ariaClose: 'Close chat',
  ariaDialog: 'Live chat with FixFlags',
} as const

/** Strict severity meanings (enum stays CRITICAL | IMPORTANT | POLISH). */
export const SEVERITY_MEANINGS = {
  CRITICAL: 'Prevents a core user outcome (blocking).',
  IMPORTANT: 'Materially harms conversion, access, or acquisition.',
  POLISH: 'Meaningful improvement or best practice.',
} as const

export const HERO = {
  badge: 'Check before you ship.',
  headline: 'Finish what your AI started.',
  headlineLine1: 'what your',
  headlineLine2: 'AI started.',
  headlineAccent: 'Finish',
  headlineAccentLegacy: false,
  subhead:
    'Paste your URL. Find what AI missed before your users do, then copy fixes back into your editor.',
  primaryCta: 'Review my site',
  navSignUpCta: 'Try free',
  trySampleCta: 'See a sample review',
  urlPlaceholder: 'your-site.com',
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
  title: 'Prove your fixes with a re-check',
  celebrationTitle: (n: number) => (n === 1 ? '1 flag cleared' : `${n} flags cleared`),
  celebrationBody: 'Your re-check confirms the fixes. Keep going on what is still open.',
  nextFixHint: 'Next up',
  cleared: 'Fixed',
  remaining: 'Still open',
  newIssues: 'New',
  regressed: 'Regressed',
  empty: 'No flag changes on this re-check.',
  compareCta: 'Open full before/after',
  compareProHint: 'Want side-by-side screenshots?',
  compareProCta: 'See Pro compare',
  outcomesHint:
    'Outcomes: Fixed, still open, unchanged severity, regressed, or unable to verify.',
} as const

export const FLAG_DISMISS_REASONS = [
  { id: 'incorrect', label: 'Incorrect' },
  { id: 'intentional', label: 'Intentional' },
  { id: 'already_fixed', label: 'Already fixed' },
  { id: 'low_priority', label: 'Low priority' },
  { id: 'duplicate', label: 'Duplicate' },
] as const

export type FlagDismissReasonId = (typeof FLAG_DISMISS_REASONS)[number]['id']

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
    title: 'Scan, fix, re-check. Repeat when the page changes.',
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
  body: 'Free check. See what\u2019s broken before you share the link. Sign up when you want the fix prompts and re-check.',
} as const

export const CHANGELOG_ENTRIES = [
  {
    date: '2026-07-20',
    title: 'Report depth and Help Center',
    items: [
      'Product Contract and Action Timeline show what we inferred and how we checked',
      'Journey and CTA flow evidence on Pro reports',
      'Help Center with guides for checks, billing, MCP, and account',
      'One free teaser check without an account; sign up to claim fix prompts',
      'Re-checks stay free and unlimited on reports you own',
    ],
  },
  {
    date: '2026-07-02',
    title: 'FixFlags launches in open beta',
    items: [
      'Sign up and create your account to start testing your sites',
      'Run free checks on any live or preview URL',
      'Get results across Message, Experience, and Reach with Pass / Needs Attention / Blocked status',
      'Fix prompts for Cursor, Claude Code, Lovable, Bolt, and Windsurf',
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
    label: 'Paste fixes into the tools you already use',
    disclaimer: '',
    logos: ['Cursor', 'Codex', 'Lovable', 'Bolt', 'Claude Code', 'Windsurf'] as const,
  },
  checkDimensions: {
    label: '',
    headline: 'What your page says, how it works, and whether it can be found.',
    exampleFindingLabel: 'Example finding',
    cards: [
      {
        id: 'message',
        title: 'Message',
        question: 'Can people understand and care in five seconds?',
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
    headline: 'Three steps. Then re-check.',
    subhead:
      'Paste a URL. Get Flags. Copy fixes into your editor. Re-check to prove it landed.',
    sampleLink: 'View full sample review',
    steps: [
      {
        step: 1,
        title: 'Flag',
        body: 'We check your page across what it says, how it works, and how it\u2019s found.',
        preview: 'yourproduct.com',
      },
      {
        step: 2,
        title: 'Fix',
        body: 'Copy the fix prompt into Cursor, Claude, Lovable, or Bolt.',
        preview: 'Paste → ship',
      },
      {
        step: 3,
        title: 'Re-check',
        body: 'Run the same URL to see which Flags cleared.',
        preview: 'Re-check complete',
        previewBadge: 'Improved',
      },
    ] as const,
  },
  reportExamples: {
    headline: 'Flags you can act on.',
    subhead: 'Real findings from the product. Same shape you get after you paste a URL.',
    seeInSample: 'See in sample',
    seeInSampleHref: '/#sample-review',
    cards: [
      {
        id: 'messaging',
        topic: 'Messaging',
        rubric: 'MESSAGE',
        severity: 'IMPORTANT',
        problem: 'Hero headline repeats the product category instead of the outcome',
        evidence:
          'Headline describes the tool category, not the visitor outcome.',
      },
      {
        id: 'mobile',
        topic: 'Mobile',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'Primary CTA is hidden below the fold on mobile',
        evidence:
          'At 375px, the hero image pushes the main action below the first screen.',
      },
      {
        id: 'accessibility',
        topic: 'Accessibility',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        problem: 'Navigation menu consumes too much viewport height on mobile',
        evidence:
          'Nav bar plus announcement banner take ~280px before content starts.',
      },
      {
        id: 'seo',
        topic: 'SEO and sharing',
        rubric: 'REACH',
        severity: 'IMPORTANT',
        problem: 'Missing og:image, link previews show blank cards',
        evidence:
          'Shared links show blank preview cards on Slack, X, and WhatsApp.',
      },
    ] as const,
  },
  whyAiNeedsFixFlags: {
    headline: 'AI ships the build. FixFlags checks the first visit.',
    lead: 'AI builds fast. Users judge in seconds.',
    body: 'FixFlags checks what the builder never experiences as a first-time visitor.',
    checks: [
      'First impressions',
      'Mobile usability',
      'Sharing previews',
      'Accessibility',
      'Trust',
      'Conversion friction',
    ] as const,
  },
  editorIntegrations: {
    headline: 'Cursor, Claude, Lovable, Bolt, and more.',
    body: 'Each Flag includes a prompt shaped for the editor you already use.',
  },
  productEvidence: {
    headline: 'What a review actually catches',
    subhead:
      'Real Flags from the product, not quote cards.',
    items: [
      {
        id: 'message',
        title: 'Message',
        lead: 'Visitors should know what you do and why it matters in five seconds.',
        findings: [
          'Hero that never names the outcome',
          'CTA that stays vague',
          'Copy that names the category, not the win',
        ],
      },
      {
        id: 'experience',
        title: 'Experience',
        lead: 'On mobile, the next step should be obvious without hunting.',
        findings: [
          'Main action buried after a long scroll on phone',
          'Tap targets too small to hit cleanly',
          'Layout that hides the next step',
        ],
      },
      {
        id: 'reach',
        title: 'Reach',
        lead: 'When someone shares your link, the card should still look like you.',
        findings: [
          'Link cards that render blank when shared',
          'Missing metadata search cannot use',
          'Sharing cards that drop your brand',
        ],
      },
    ] as const,
    cta: 'See a sample review',
    ctaHref: '/#sample-review',
  },
  /** @deprecated Prefer reportExamples / sample explorer. Kept for AGENTS social-proof disclaimer invariant. */
  testimonials: {
    headline: 'What a review actually catches',
    subhead: 'Real Flags from the product, not quote cards.',
    disclaimer: 'Illustrative findings only. Not attributed customer testimonials.',
    cardLabel: 'Example finding',
    quotes: [
      // Empty on purpose: homepage uses real Flag examples, not quote cards.
    ] as ReadonlyArray<{
      id: string
      quote: string
      role: string
      context: string
    }>,
  },
  sampleReport: {
    label: '',
    headline: 'A review you can paste into your editor.',
    body: 'Each Flag has evidence, impact, and a fix prompt.',
    cta: 'Explore all Flags',
    ctaWithCount: (n: number) => `Explore all ${n} Flags`,
    illustrativeLabel: '',
  },
  footer: {
    tagline:
      'Reviews for AI-built and live sites. Flags with evidence, and fix prompts you can paste.',
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
      // Instagram handle TBD. Do not ship a wrong/legacy URL.
      instagram: '',
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
    question: 'How are scores calculated?',
    answer: `${SCORE_HELP.short} ${SCORE_HELP.detail}`,
  },
  {
    question: 'What do Critical, Important, and Polish mean?',
    answer: `Critical: ${SEVERITY_MEANINGS.CRITICAL} Important: ${SEVERITY_MEANINGS.IMPORTANT} Polish: ${SEVERITY_MEANINGS.POLISH}`,
  },
  {
    question: 'Do I need an account for my first check?',
    answer: `No. One free teaser scan shows scores, Flags, and evidence without an account. ${OFFER.short} Create a free account for fix prompts, re-check, and 3 new URL checks with full reports.`,
  },
  {
    question: 'What\u2019s included in the free plan vs Pro?',
    answer:
      'Free: one teaser scan without an account (evidence and Flags, fix prompts after signup), then 3 new URL checks with full reports on a free account, plus unlimited re-checks on reports you own. Pro: before/after compare, MCP in Cursor or Claude, and 25 new URL checks per month.',
  },
  {
    question: 'Do I need Cursor or MCP?',
    answer:
      'No. MCP is optional on Pro. Fix prompts copy into any editor, ticket, or brief. Lovable and Bolt work by paste today.',
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
    question: 'Are my reports public?',
    answer: `${OFFER.linkPrivacy} Agency plans can create public share links. Separate public pages for sites are for discovery; they are not your private audit.`,
  },
  {
    question: 'Does it work on staging/password-protected sites?',
    answer:
      'FixFlags checks publicly accessible URLs only. Localhost, private networks, and password-protected pages are not supported yet.',
  },
  {
    question: 'We already have a live site. Is this only for pre-launch?',
    answer:
      'No. FixFlags checks any public page, live or new. You get a prioritized fix list with screenshots, not another performance score.',
  },
  {
    question: 'Who is FixFlags for?',
    answer:
      'Builders shipping with AI tools like Cursor, Lovable, and Bolt, and teams with a live site that gets traffic but weak conversion. Not for enterprise QA suites or password-only staging.',
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
    body: 'Paste a URL. See Flags across three rubrics. Sign up for fix prompts you can paste into your editor.',
  },
  noFlags: {
    title: 'No flags found',
    body: 'This scan did not surface any issues. Nice work.',
  },
  aiPending: {
    title: 'Fix prompts generating',
    body: 'Generating fix prompts for every flag. This usually takes under a minute.',
    stillPendingTitle: 'Fix prompts still generating',
    stillPendingBody: 'This is taking longer than usual. Refresh the page, or check back in a minute.',
    refreshCta: 'Refresh',
  },
  prescriptionUnavailable: {
    title: 'Fix prompts unavailable',
  },
  triageUnavailable: {
    title: 'AI summary unavailable',
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
    topPriorities: 'Finish Plan',
    topPrioritiesHint:
      'The highest-leverage improvements next. Copy into Cursor, Claude Code, or any editor with plan mode.',
    productContract: 'Product contract',
    productContractHeading: 'What this product appears to do',
    journey: 'User journey walk',
    flow: 'CTA flow test',
    timelineCompleted: 'How we checked',
    timelineProgressive: 'What FixFlags is doing',
    timelineEmpty: 'Scan steps will appear as FixFlags checks the page.',
    previews: 'Share & search previews',
    copyFixPlan: (n: number) => `Copy Finish Plan (${Math.min(3, n)})`,
  },
  stickyNav: {
    contract: 'Contract',
    priorities: 'Finish Plan',
    journey: 'Journey',
    flow: 'Flow',
    timeline: 'Timeline',
    flags: 'Flags',
    previews: 'Previews',
    launch: 'Launch',
  },
  explorer: {
    allPages: 'All Pages',
    noMatchFilter: 'No flags match this filter.',
    checkingIssues: 'Checking for issues…',
    selectFlag: 'Select a flag to see evidence and the fix prompt.',
    flagsAppear: 'Flags appear here as the scan finishes.',
    noFlagsNice: 'No flags. Nice work.',
  },
  runYourOwnAudit: 'Run your own audit',
} as const

export const EXAMPLES_PAGE = {
  label: 'Examples',
  headline: 'Example audits from recognizable sites',
  body: 'Real audit output from recognizable sites. Each card shows top issues and fix prompts.',
} as const

export const BLOG_INDEX = {
  label: 'Blog',
  headline: 'Notes on shipping without the embarrassing bugs',
} as const

export const ROAST_META = {
  title: 'Website Roast - FixFlags',
  description:
    'Get a blunt quality check across Message, Experience, and Reach. Paste a URL, get a grade, then fix what matters.',
  ogDescription: 'Paste your URL. Get roasted. Fix what matters.',
} as const

export const MCP_DOCS = {
  headline: 'MCP Integration',
  subhead:
    'Your agent can check and fix your site without you copy-pasting URLs. Connect FixFlags to your AI coding tool.',
  quickStart: [
    'Generate an API key in Settings → API Keys (Pro plan)',
    'Paste the HTTP config into Cursor, Claude Code, or Windsurf',
    'Run ff_check_url: use the curl test below to verify your key',
    'Optional: build the local CLI from fixflags-cli/ (`npm run build` then `node bin/fixflags.js`)',
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
    { name: 'ff_monitoring', desc: 'Re-check the same URL to see which Flags cleared.' },
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
    passkeyCta: 'Sign in with passkey',
    footer: 'Don\u2019t have an account?',
    footerLink: 'Sign up',
    forgotPassword: 'Forgot password?',
    oauthNote: 'We never post or access your repositories.',
  },
  twoFactor: {
    title: 'Confirm it\u2019s you',
    subtitle: 'Use your passkey to finish signing in',
    passkeyCta: 'Continue with passkey',
    backupLabel: 'Or enter a backup code',
    backupCta: 'Verify backup code',
    backupPlaceholder: 'Backup code',
    trustDevice: 'Remember this device for 30 days',
    backToSignIn: 'Back to sign in',
  },
  security: {
    title: 'Two-factor authentication',
    description:
      'Add a passkey, then require it after your password. Passkeys use your device biometrics or a security key.',
    passkeysTitle: 'Passkeys',
    passkeysEmpty: 'No passkeys yet. Add one to enable two-factor authentication.',
    addPasskey: 'Add passkey',
    renamePasskey: 'Rename',
    deletePasskey: 'Remove',
    enableTitle: 'Require passkey at sign-in',
    enableDescription:
      'After your password, FixFlags asks for a registered passkey before opening your account.',
    enableCta: 'Enable passkey 2FA',
    disableCta: 'Disable 2FA',
    enabledBadge: 'Enabled',
    disabledBadge: 'Off',
    passwordLabel: 'Current password',
    passwordlessHint: 'OAuth-only accounts can enable without a password.',
    backupCodesTitle: 'Save your backup codes',
    backupCodesBody:
      'Store these somewhere safe. Each code works once if you lose access to your passkeys.',
    backupCodesCopied: 'Backup codes copied',
    copyBackupCodes: 'Copy codes',
    regenerateBackupCodes: 'Generate new backup codes',
  },
  signUp: {
    title: 'Create your free account',
    subtitle: '3 new URL checks · Unlimited re-checks · Upgrade anytime',
    subtitleWithOAuth: 'Continue with Google or GitHub, or create with email',
    fromPricing: 'Create your free account: 3 new URL checks included, upgrade anytime',
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

export const FLAG_FEEDBACK_COPY = {
  thanksUp: 'Thanks for the feedback!',
  thanksDown: "Got it, we'll improve this.",
  saveFailed: 'Failed to save feedback',
  dismissPrompt: 'Why are you dismissing this flag?',
  dismissed: 'Flag dismissed.',
} as const

export const FIRST_AUDIT_PROMPT = {
  headline: 'Paste the URL you are about to share.',
  body: 'FixFlags reviews your page before anyone else sees it. You get Flags across Message, Experience, and Reach with evidence. Create a free account for fix prompts you can paste into Cursor, Claude, Lovable, or Bolt.',
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

export const ANON_VALUE_STRIP = {
  headline: (n: number) => `${n} flag${n === 1 ? '' : 's'} found`,
  body: 'Evidence and why it matters are below. Create a free account for fix prompts, re-check, and more URL checks.',
  primaryCta: 'Create free account',
  secondaryCta: 'Sign in',
} as const

export const LOCKED_INSPECTION = {
  headline: 'Sign in to inspect this issue',
  body: 'This report includes evidence, screenshots, and fix prompts for every flag.',
  features: [
    'Screenshot evidence with interactive pins',
    'Detailed explanation of the issue',
    'Why this matters for your users',
    'How to verify the fix',
    'Fix prompt for your editor',
  ],
  primaryCta: 'Sign in',
  secondaryCta: 'Create free account',
} as const

export const LOCKED_CONTENT_TEASER = {
  defaultLabel: 'Sign up to view',
  fixPromptLabel: 'Create a free account to get the fix prompt for this flag',
  primaryCta: 'Create free account',
  secondaryCta: 'Sign in',
} as const

export const SAMPLE_FIX = {
  label: 'Example fix',
  fixTitle: 'Fix',
  signInCta: 'Sign in',
  subtext: (n: number) => `One sample fix below. Create a free account to see all ${n} fix prompts, save reports, re-check, and run more URL checks.`,
  primaryCta: 'Create free account',
} as const

export const UPGRADE_MOMENTS = {
  audit_limit_reached: {
    headline: 'You\u2019ve used your 3 new URL checks',
    body: 'Re-checks on reports you own stay free and unlimited. Upgrade to Pro for 25 new URL checks per month, before/after compare, and MCP in Cursor or Claude.',
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
    { status: 'JUDGING', label: 'AI review', subtitle: 'Prioritizing Flags from evidence...' },
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
      'Prioritizing Flags by launch impact...',
      'Preparing the report for review...',
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
    title: 'FixFlags - Check before you ship',
    description:
      'Your AI says it\u2019s done. Paste a URL and FixFlags checks the product: message gaps, UX issues, missing metadata. Fix prompts for Cursor, Claude, Lovable, and Bolt. Free check.',
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
  help: {
    title: 'Help Center',
    description:
      'Guides for FixFlags checks, reports, billing, MCP setup, and your account. Chat with us when you need a human.',
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
  issues: {
    title: 'Issue Library',
    description: 'Real issues found across audited sites. Frequency, affected frameworks, examples, and fixes.',
  },
} as const
