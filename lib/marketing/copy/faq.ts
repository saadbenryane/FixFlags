export const FAQ_SECTION = {
  title: 'Common questions',
  viewAll: 'View all questions',
  label: 'FAQ',
} as const

export const FAQ_PAGE = {
  title: 'Frequently asked questions',
  subhead:
    'How FixFlags checks a live website, what a Flag means, and what is free.',
} as const

export type FaqEntry = {
  question: string
  answer: string
  learnMore?: { href: string; label: string }
}

export function faqEntryAnchor(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'question'
}

export const FAQ: readonly FaqEntry[] = [
  {
    question: 'Is FixFlags free?',
    answer:
      'Yes. One website is free, verified weekly. Pro is $49 per website per month, verified every day. We are not charging yet. Shopify is an optional connection, not the only way to start.',
    learnMore: { href: '/help/account-and-billing/free-and-pro', label: 'Free vs Pro' },
  },
  {
    question: 'What does FixFlags actually check?',
    answer:
      'FixFlags opens your live website, follows important pages and actions, and records what actually happens. It is not an uptime ping, a Lighthouse score, or a recording of your visitors.',
    learnMore: { href: '/help/sites-and-coverage/read-site-coverage', label: 'What FixFlags checks' },
  },
  {
    question: 'What is a Flag?',
    answer:
      'A Flag is something important that needs attention, with evidence. It says what happened, where it happened, and what should happen next. Healthy pages stay quiet.',
    learnMore: { href: '/help/flags-fix-verify/read-a-flag', label: 'Reading Flags' },
  },
  {
    question: 'How do I start?',
    answer:
      'Enter a public website URL. FixFlags checks the live site and shows Flags with evidence. You can add Shopify later if you need store context.',
    learnMore: { href: '/help/getting-started/analyze-a-website', label: 'Start an analysis' },
  },
  {
    question: 'How do I verify a fix?',
    answer:
      'Publish the change, then run a fresh check on the same behavior. The old Flag is not resolved just because it disappeared from a list. FixFlags has to see the success state.',
    learnMore: { href: '/help/flags-fix-verify/verify-a-flag', label: 'Verify a fix' },
  },
  {
    question: 'Do you charge or complete checkout on a store?',
    answer:
      'No. When FixFlags checks a purchase path, it stops before payment. It never enters card details or places an order.',
    learnMore: { href: '/help/sites-and-coverage/read-site-coverage', label: 'How a check works' },
  },
  {
    question: 'What about Shopify?',
    answer:
      'Shopify is a connection for the same Site. It adds product information and independent checks of selected purchase paths through checkout entry. Connect it from Site settings when that context would help.',
    learnMore: { href: '/docs/integrations/shopify', label: 'Read integration guide' },
  },
  {
    question: 'Can I see what FixFlags saw?',
    answer:
      'Yes. Each Flag keeps the capture, reproduction, and expected result. This is FixFlags\' own check, not session replay of your visitors.',
    learnMore: { href: '/help/privacy-and-security/privacy-and-evidence', label: 'Evidence' },
  },
  {
    question: 'Who is FixFlags for?',
    answer:
      'Anyone who needs to know how their website is doing, what needs attention, and what to do next. Sell, book, collect a lead, or run a tool. FixFlags follows the pages behind that result.',
    learnMore: { href: '/how-it-works', label: 'How it works' },
  },
] as const

export const CHANGELOG_PAGE = {
  label: 'Changelog',
  headline: 'What is new in FixFlags',
  body: 'Updates to the checks, evidence, and guides behind your Site.',
  docsCta: 'Explore the documentation',
} as const

export const CHANGELOG_ENTRIES = [
  {
    date: '2026-10-11',
    title: 'Integration setup belongs in the docs',
    items: [
      'Shopify, Google Analytics, and Google Search Console now have complete guides for setup, permissions, coverage, and recovery',
      'Available integrations link to their guides, and Site settings includes contextual documentation links',
      'Shopify authorization failures return to a recovery message in the guide',
      'The standalone Shopify install page has been retired in favor of connecting from an owned Site',
    ],
  },
  {
    date: '2026-09-20',
    title: 'One Site, looked after',
    items: [
      'Your dashboard now shows Sites, meaningful Flags, coverage freshness, and Watch state',
      'Every Site has durable Home, Flags, Flag detail, and Settings routes',
      'Flag verification records fresh comparable evidence as Verified, Still open, Regressed, or Couldn’t verify',
      'The Site Agent answers from persisted evidence and can escalate to human support with Site context',
    ],
  },
  {
    date: '2026-09-19',
    title: 'Watch and Shopify join the same product',
    items: [
      'Free Sites receive weekly Watch and paid plans are prepared for daily Watch',
      'Choose Flags, Critical only, or Off, with recovery notices controlled separately',
      'Shopify links to an owned Site and adds purchase-path context to its existing cards and Flags',
      'Watch notifications return to the exact owned Flag when one needs attention',
    ],
  },
  {
    date: '2026-09-18',
    title: 'A clearer first run',
    items: [
      'Analyze a public URL before signup and claim the same Site after authentication',
      'Coverage now distinguishes fresh evidence, partial checks, exclusions, and unavailable protected pages',
      'Help, Docs, pricing, samples, legal, email, and errors now use the same Site and Flag vocabulary',
    ],
  },
] as const
