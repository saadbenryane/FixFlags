import { helpHrefForSurface } from '@/lib/help/contextual'

export const BRAND = {
  name: 'FixFlags',
  domain: 'fixflags.com',
  tagline: 'Finish what your AI started.',
  category: 'Product QA for AI-built products.',
  oneLiner: 'Product QA for what you shipped: review, fix, update review, and verify before you share.',
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
  nextStep: 'Paste into editor → publish → run an update review.',
} as const

export const URL_PLACEHOLDER = 'https://yoursite.com'

export const TOOLS = {
  metaPreview: {
    badge: 'Free Tool',
    heading: 'Meta Preview Tool',
    subhead:
      'See how your page looks when shared on Slack, X, LinkedIn, and Discord. Enter a URL to check its og:image, title, and description tags.',
    ctaCheck: 'Check preview',
    ctaAudit: 'Run a product review on this URL',
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
    auditHeading: 'Run a product review',
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
    issuesFound: '{count} match{plural} found',
    typeLabels: {
      placeholder: 'Placeholder',
      'template-copy': 'Template Copy',
      'ai-builder': 'AI Builder Artifact',
      'template-token': 'Template Token',
      'social-proof': 'Social proof',
    },
    auditHeading: 'Run a product review',
    auditSubhead:
      'Get a complete report across Message, Experience, and Reach with fix prompts your AI agent can run.',
  },
  shared: {
    auditHeading: 'Run a product review',
    auditSubhead:
      'Get a complete report across Message, Experience, and Reach with fix prompts your AI agent can run.',
    ctaAudit: 'Run a product review on this URL',
  },
} as const

export const ROAST_COPY = {
  title: 'Website Roast',
  subhead: 'Paste your URL. Get roasted. Fix what matters.',
  placeholder: URL_PLACEHOLDER,
  cta: 'Roast it',
  ctaLoading: 'Roasting...',
  overallLabel: 'Overall Quality',
  topIssuesHeading: 'Top Flags',
  shareBadge: 'Share your quality badge',
  downloadSvg: 'Download SVG',
  copyMarkdown: 'Copy markdown',
  fullReport: 'Full report',
  wantFixes: 'Want a fix prompt for every Flag?',
  runFullAudit: 'Run a full FixFlags check',
  taglines: {
    A: 'Ship it. This is ready for humans.',
    B: 'Solid foundation. A few tweaks and you are golden.',
    C: 'Not bad. Some issues visitors notice.',
    D: 'Your site has feelings. Mostly pain.',
    F: 'We roasted your site so your users do not have to.',
    default: 'Every site has room to grow.',
  },
  rubricVerdicts: {
    MESSAGE: {
      A: 'Clear, focused, and built to convert.',
      B: 'Good messaging. Minor clarity gaps.',
      C: 'Visitors understand what you do. Eventually.',
      D: 'Your headline is working against you.',
      F: 'Visitors have no idea what this is about.',
    },
    EXPERIENCE: {
      A: 'Fast, accessible, and free of dead ends.',
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
  line: 'Free product review. See what needs attention. Sign up when you want fix prompts and update reviews.',
  short: 'Free product review. See what needs attention before you share the link.',
  /** Privacy page / FAQ only. Do not render on marketing heroes. */
  privacy: 'We scan your live URL. We do not change your site or touch your code.',
  reportAccess:
    'Report evidence is public at its link. Agent chat, fix prompts, Product Memory, and account history stay available only to the report owner.',
} as const

/** User-facing score explanation. Must match lib/audit/scoring.ts. */
export const SCORE_HELP = {
  diagnostic:
    'An issue-weighted summary of this Review. It is not a prediction of conversion or revenue.',
  short:
    'An issue-weighted summary of this Review. It is not a prediction of conversion or revenue. Each rubric starts at 100 and drops with the number and severity of unresolved Flags across Message, Experience, and Reach.',
  detail:
    'An issue-weighted summary of this Review. It is not a prediction of conversion or revenue. Each rubric starts at 100. Critical Flags subtract more than Important, which subtract more than Polish. The overall score weights Experience highest, then Message, then Reach. Experience may also blend in PageSpeed when available.',
  comparableLabel: "On last Review's Flags",
  comparableHelp:
    'Same scoring formula, only on Flags this update review already knew. New observations stay in the full score.',
  /** Canonical deep link via lib/help contextual surfaces */
  faqHref: helpHrefForSurface('score_help'),
} as const

/** Help Center chrome. Article bodies live in lib/help/catalog.ts. */
export const HELP_CENTER = {
  label: 'Help Center',
  title: 'How can we help?',
  subhead: 'Search guides for Product Reviews, billing, and your account. Still stuck? Chat with us.',
  searchPlaceholder: 'Search help and docs…',
  categoriesHeading: 'Browse by topic',
  popularHeading: 'Popular articles',
  noResults: 'No articles match that search. Try another phrase or open chat.',
  stillStuck: 'Still stuck?',
  openChatCta: 'Open chat',
  emailCta: 'Email us',
  relatedHeading: 'Related articles',
  backToHelp: 'Back to Help Center',
  mcpGuideCta: 'Open the report guide',
  askSupportCta: 'Ask support',
  viewHelpCta: 'View help article',
} as const

/** Live chat widget + welcome SYSTEM message (must match lib/help/sla.ts). */
export const SUPPORT_CHAT = {
  title: 'Chat with FixFlags',
  subtitle: 'We typically reply within a few hours',
  emptyState: 'Ask us anything about FixFlags, your report, or getting started.',
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

export function severityLabel(severity: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'Critical Flag',
    IMPORTANT: 'Important Flag',
    POLISH: 'Polish Flag',
  }
  return map[severity] ?? severity
}

export function rubricLabel(name: string): string {
  const map: Record<string, string> = {
    MESSAGE: 'Message',
    EXPERIENCE: 'Experience',
    REACH: 'Reach',
  }
  return map[name] ?? name
}

export function rubricDescription(name: string): string {
  const map: Record<string, string> = {
    MESSAGE:
      'Does the page make sense and feel credible? Copy, headline, positioning, audience, benefits, social proof, and trust signals.',
    EXPERIENCE:
      'Does the page work well for users? Design, layout, mobile, accessibility, speed, visual consistency, and failed interactions.',
    REACH:
      'Can people find, share, and measure it? SEO, metadata, share previews, analytics, and conversion tracking.',
  }
  return map[name] ?? ''
}

export function impactTagLabel(tag: string | null | undefined): string | null {
  if (!tag) return null
  const map: Record<string, string> = {
    CONVERSION: 'Conversion',
    REVENUE: 'Revenue',
    TRUST: 'Trust',
    MEASUREMENT: 'Measurement',
    SHARING: 'Sharing',
    SEO: 'SEO',
    ACCESSIBILITY: 'Accessibility',
  }
  return map[tag] ?? tag
}
