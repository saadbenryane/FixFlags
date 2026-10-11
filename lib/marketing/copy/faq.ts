import { PUBLIC_OFFER } from './public-offer'

export const FAQ_SECTION = {
  title: 'Common questions',
  viewAll: 'View all questions',
  label: 'FAQ',
} as const

export const FAQ_PAGE = {
  title: 'Frequently asked questions',
  guidesLead: 'Prefer step-by-step guides?',
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
    question: 'How do I start?',
    answer: 'Enter a public website URL for your first analysis. Save your Site and turn on monitoring to keep checking what matters.',
    learnMore: { href: '/docs/getting-started', label: 'Get started' },
  },
  {
    question: 'What does FixFlags actually check?',
    answer: 'FixFlags checks reachable pages, public action destinations, and available evidence across eight website areas. Connections and configured journeys add coverage. Every result applies to the pages and actions actually checked.',
    learnMore: { href: '/coverage', label: 'What FixFlags checks' },
  },
  {
    question: 'What is a Flag?',
    answer: 'A Flag is an important problem with evidence: what happened, where it happened, and what should happen instead. Suggestions and areas without enough evidence remain distinct.',
    learnMore: { href: '/help/flags-fix-verify/read-a-flag', label: 'Read a Flag' },
  },
  {
    question: 'Can I see what FixFlags saw?',
    answer: 'Yes. Open the recorded evidence, affected page, scope, and expected result. You can explore a recorded demo check before analyzing your own website.',
    learnMore: { href: '/samples', label: 'Explore the product sample' },
  },
  {
    question: 'How do I verify a fix?',
    answer: 'Publish the change, then select Check now on the same Flag. This returns to Monitor: FixFlags checks the same live behavior again. The Flag closes only when fresh evidence confirms recovery. Your saved monitoring schedule continues independently.',
    learnMore: { href: '/docs/fix-with-ai', label: 'Fix and verify' },
  },
  {
    question: 'When does monitoring start?',
    answer: 'Save your Site and enable monitoring. Confirm the schedule and next check in Site settings. Monitoring follows configured coverage, and notifications follow your preferences.',
    learnMore: { href: '/docs/site-care#watch', label: 'Understand monitoring' },
  },
  {
    question: 'Do you record my visitors?',
    answer: 'FixFlags records its own website checks, including screenshots and browser observations. It does not record your visitors’ sessions. Optional connections can add store, traffic, or search context.',
    learnMore: { href: '/security', label: 'Privacy and security' },
  },
  {
    question: 'Is FixFlags free?',
    answer: [PUBLIC_OFFER.free, PUBLIC_OFFER.availability, PUBLIC_OFFER.usage].join(' '),
    learnMore: { href: '/pricing', label: 'See current usage allowances' },
  },
  {
    question: 'Do you charge or complete checkout on a store?',
    answer: 'No. Purchase-path checks stop before payment. FixFlags does not enter card details or place an order. Reaching checkout does not prove that payment completes.',
    learnMore: { href: '/coverage#conversion', label: 'Purchase-path coverage' },
  },
  {
    question: 'What about Shopify?',
    answer: 'Shopify adds product information and selected purchase-path checks to the same Site. You can start with a public URL and connect your store from Site settings when that context helps.',
    learnMore: { href: '/docs/integrations/shopify', label: 'Read the Shopify guide' },
  },
  {
    question: 'Who is FixFlags for?',
    answer: 'People responsible for live websites: founders, ecommerce operators, agencies, and marketing teams. Start with the pages and actions that matter to the website you look after.',
    learnMore: { href: '/use-cases', label: 'Explore use cases' },
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
      'Your Site keeps its overview, Flags, evidence, and settings together',
      'Flag verification records fresh comparable evidence as Verified, Still open, Regressed, or Couldn’t verify',
      'The Site Agent uses your recorded evidence and can help you reach human support',
    ],
  },
  {
    date: '2026-09-19',
    title: 'Watch and Shopify join the same product',
    items: [
      'Monitoring starts after a schedule is saved, with the next check shown in Site settings',
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
