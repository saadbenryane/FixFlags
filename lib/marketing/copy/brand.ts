

export const BRAND = {
  name: 'FixFlags',
  domain: 'fixflags.com',
  tagline: 'Finish what your AI started.',
  category: 'Independent product verification for AI-built products.',
  oneLiner: 'Check your AI-built product, fix what blocks the release, re-check, and watch until it ships.',
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

export const URL_PLACEHOLDER = 'https://yoursite.com'

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
  placeholder: URL_PLACEHOLDER,
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
    'Each rubric starts at 100 and drops based on the number and severity of unresolved flags across Message, Experience, and Reach.',
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
