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
    'Getting started, fixing problems, and keeping your website checked.',
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
    answer: 'Enter your website address for a free check. Create a free account to see and keep the results, get fix instructions you can copy and paste, and start scheduled checks. If you previously paused this website’s checks, they stay paused.',
    learnMore: { href: '/docs/getting-started', label: 'Get started' },
  },
  {
    question: 'What does FixFlags actually check?',
    answer: 'Broken pages, slow loading, buttons that go nowhere, phone layouts, and more. We also look for improvements to search, accessibility, and other website basics. Every result tells you which pages and actions we checked, and what we couldn’t check.',
    learnMore: { href: '/coverage', label: 'What FixFlags checks' },
  },
  {
    question: 'What is a Flag?',
    answer: 'A Flag is a problem that needs attention. It shows the page, what went wrong, and instructions to help fix it. Suggestions and things we couldn’t check are shown separately.',
    learnMore: { href: '/help/flags-fix-verify/read-a-flag', label: 'Read a Flag' },
  },
  {
    question: 'Can I see what FixFlags saw?',
    answer: 'Yes. Open a problem to see the page and the details from our check, including screenshots when available. You can try the sample before checking your own website.',
    learnMore: { href: '/how-it-works#sample', label: 'Explore the product sample' },
  },
  {
    question: 'How do I know a fix worked?',
    answer: 'Publish the update, open the problem in FixFlags, and select Recheck. We mark it fixed only when a fresh check confirms the same page or action works. Your scheduled checks keep running too.',
    learnMore: { href: '/docs/fix-with-ai', label: 'Check a fix' },
  },
  {
    question: 'Who makes the fixes?',
    answer: 'You choose how to make the change. Copy our fix instructions and paste them where you built your website, or send them to someone who helps you. Review and publish the update, then let FixFlags check it. Copying the instructions alone does not change your website.',
    learnMore: { href: '/docs/fix-with-ai', label: 'Use the fix instructions' },
  },
  {
    question: 'Do I need to know how to code?',
    answer: 'You can check your website without writing code. We explain problems in plain language and give you fix instructions to copy and paste. If you use a tool such as Lovable, paste them into the same chat you use to make changes. Some problems may need help from a developer.',
    learnMore: { href: '/how-it-works', label: 'See how it works' },
  },
  {
    question: 'Do I have to keep running checks?',
    answer: 'No. Save a new website and we’ll keep checking on its default schedule. We can email you about new problems and confirmed fixes. Change or pause the schedule in Settings.',
    learnMore: { href: '/docs/site-care#watch', label: 'Set up monitoring' },
  },
  {
    question: 'When does monitoring start?',
    answer: 'When you save a new website to your account. Settings shows when the next check will run and lets you change or pause the schedule. A website you previously paused stays paused. Email alerts follow your preferences.',
    learnMore: { href: '/docs/site-care#watch', label: 'Understand monitoring' },
  },
  {
    question: 'Do you record my visitors?',
    answer: 'No. We record our own checks, including screenshots and what happened on the page. We do not record your visitors’ sessions.',
    learnMore: { href: '/security', label: 'Privacy and security' },
  },
  {
    question: 'Is FixFlags free?',
    answer: [PUBLIC_OFFER.free, PUBLIC_OFFER.availability, PUBLIC_OFFER.usage].join(' '),
    learnMore: { href: '/pricing', label: 'See current usage allowances' },
  },
  {
    question: 'Do you charge or complete checkout on a store?',
    answer: 'No. We stop before payment. We do not enter card details or place an order. Opening checkout does not prove that a payment will go through.',
    learnMore: { href: '/coverage#conversion', label: 'Purchase-path coverage' },
  },
  {
    question: 'What about Shopify?',
    answer: 'The Shopify connection is coming soon. You can check your store’s public pages now by entering its website address. If you already have a Shopify connection, you can disconnect it in Settings.',
    learnMore: { href: '/docs/integrations/shopify', label: 'Read the Shopify guide' },
  },
  {
    question: 'Who is FixFlags for?',
    answer: 'Anyone looking after a live website or app, from someone building their first project to store owners, agencies, and marketing teams. Start with the pages your visitors use most.',
    learnMore: { href: '/ai-builders', label: 'For AI builders' },
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
    date: '2026-11-11',
    title: 'Connect your coding agent over MCP',
    items: [
      'The FixFlags MCP server is live: connect a coding agent to read Flag evidence and request a recheck. Setup is in the MCP guide.',
    ],
  },
  {
    date: '2026-11-10',
    title: 'Built for AI builders: fix it, then prove it',
    items: [
      'A new homepage shows one Flag from check to fix to verified recheck, using a real capture from our demo store',
      'Pages for Lovable, Bolt, v0, Replit, Cursor and Claude Code show where to paste fix instructions',
      'Your Site leads with the problem to fix first, and broken buttons and journeys now rank above slow-loading pages',
      'A fix confirmed by a recheck shows a Verified receipt with when it was found, when it was confirmed, and how long it took',
      'Check your Site after every deploy with one request from GitHub Actions, Vercel, Netlify or any script',
      'Open fix instructions directly in Cursor, and see what a running check is trying right now',
      'A free broken link checker, plus guides for a checkout that broke after a deploy, an AI-built site launch, and how FixFlags compares with Lighthouse',
    ],
  },
  {
    date: '2026-11-10',
    title: 'Clearer summaries, reports, and guides',
    items: [
      'Daily and weekly summary emails preview what needs attention and link to the fix instructions',
      'Confirmed results no longer show as incomplete when optional AI explanations are unavailable',
      'Website reports are simpler, with clearer report and timeline states',
      'New guides on keeping a website working after you publish it',
      'Site navigation and evidence links work better with enlarged text and on touch screens',
    ],
  },
  {
    date: '2026-10-11',
    title: 'Integration setup belongs in the docs',
    items: [
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
      'Shopify links to an owned Site and adds purchase-path context to its existing cards and Flags (Shopify setup has since moved to coming soon)',
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
