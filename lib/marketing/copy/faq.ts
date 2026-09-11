import { CORE_LOOP_LABEL } from './terminology'

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
    learnMore: { href: '/help/billing-and-plans/free-vs-pro', label: 'Free vs Pro' },
  },
  {
    question: 'What does FixFlags actually check?',
    answer:
      'FixFlags opens your live website, follows important pages and actions, and records what actually happens. It is not an uptime ping, a Lighthouse score, or a recording of your visitors.',
    learnMore: { href: '/help/checks-and-reports/vs-lighthouse', label: 'What FixFlags checks' },
  },
  {
    question: 'What is a Flag?',
    answer:
      'A Flag is something important that needs attention, with evidence. It says what happened, where it happened, and what should happen next. Healthy pages stay quiet.',
    learnMore: { href: '/help/checks-and-reports/scores-and-severity', label: 'Reading Flags' },
  },
  {
    question: 'How do I start?',
    answer:
      'Enter a public website URL. FixFlags checks the live site and shows Flags with evidence. You can add Shopify later if you need store context.',
    learnMore: { href: '/help/getting-started/first-check', label: 'Start a check' },
  },
  {
    question: 'How do I verify a fix?',
    answer:
      'Publish the change, then run a fresh check on the same behavior. The old Flag is not resolved just because it disappeared from a list. FixFlags has to see the success state.',
    learnMore: { href: '/help/getting-started/flag-fix-recheck', label: 'Verify a fix' },
  },
  {
    question: 'Do you charge or complete checkout on a store?',
    answer:
      'No. When FixFlags checks a purchase path, it stops before payment. It never enters card details or places an order.',
    learnMore: { href: '/help/checks-and-reports/evidence-and-screenshots', label: 'How a check works' },
  },
  {
    question: 'What about Shopify?',
    answer:
      'Shopify is a connection for the same Site. It can add product structure and independent purchase-path checks. Install it when that context would help, not as a separate product.',
    learnMore: { href: '/install', label: 'Connect Shopify' },
  },
  {
    question: 'Can I see what FixFlags saw?',
    answer:
      'Yes. Each Flag keeps the capture, reproduction, and expected result. This is FixFlags\' own check, not session replay of your visitors.',
    learnMore: { href: '/help/checks-and-reports/evidence-and-screenshots', label: 'Evidence' },
  },
  {
    question: 'Who is FixFlags for?',
    answer:
      'Anyone who needs to know how their website is doing, what needs attention, and what to do next. Sell, book, collect a lead, or run a tool. FixFlags follows the pages behind that result.',
    learnMore: { href: '/how-it-works', label: 'How it works' },
  },
] as const

export const CHANGELOG_ENTRIES = [
  {
    date: '2026-08-27',
    title: 'A clearer path from URL to Fix',
    items: [
      'Paste a public URL and watch Agent chat fill in beside your Report as the evidence lands',
      'Each Product keeps score history, Your priorities, and Watch together, with Message, Experience, and Reach at a glance',
      'Fix prompts name the live page and section so you can paste straight into Cursor, Claude Code, Lovable, or Bolt',
      'Copy all gathers your ranked Fix list in one go; Export holds Copy link and Email me this report',
      'Flags put Message and Experience ahead of Reach when the stakes are equal',
      'Try a review without an account: you see the Flags and evidence, then save to unlock the fix prompts',
      'Billing shows how many Site checks you have used this month, including update reviews and Watch',
    ],
  },
  {
    date: '2026-07-22',
    title: 'A complete Fix list and public report links',
    items: [
      'Every report now opens with every unresolved Flag ranked by launch impact',
      'Screenshots, evidence, and fixes now share one report workspace',
      'The sample shows the same complete Fix list without a loading gap',
      'Every report has one canonical link for sharing its evidence',
      'Sign-in waits until your anonymous report is safely attached to your account',
    ],
  },
  {
    date: '2026-07-20',
    title: 'Report depth and Help Center',
    items: [
      'Product Contract and Action Timeline show what we inferred and how we checked',
      'Funnel and CTA flow evidence in reports',
      'Help Center with guides for reviews, billing, and account',
      'One free teaser review without an account; sign up to claim fix prompts',
      'Update reviews use product review credits on every plan',
    ],
  },
  {
    date: '2026-07-02',
    title: 'FixFlags launches in open beta',
    items: [
      'Sign up and create your account to start testing your sites',
      'Run free Site checks on any live or preview URL',
      'See Critical Flag counts across Message, Experience, and Reach',
      'Fix prompts for Cursor, Claude Code, Lovable, Bolt, Windsurf, and Devin',
      'View your report history and AI tool usage from your dashboard',
    ],
  },
] as const

export const BLOG_POSTS = [
  {
    slug: 'why-ai-built-sites-need-a-launch-check',
    title: 'Why AI-built sites still need a final review',
    date: '2026-07-02',
    excerpt:
      'AI coding tools move fast, but speed skips the boring checks: dead CTAs, missing preview images, missing alt text. Here is why a final review matters before you share the link.',
    body: [
      'AI coding tools are very good at producing a page that looks finished. They are much less good at noticing the things that only show up when someone else actually uses the page: a call-to-action that points nowhere, an Open Graph image that never loads, a form input with no label.',
      'None of these are hard to fix. Almost all of them are invisible until a real user, or a QA pass, goes looking.',
      'That gap is what "finish what your AI started" means in practice. The build gets you 90% of the way. The last 10% is the pass that catches what speed skipped, and it is exactly the kind of checklist work that is easy to automate and easy to skip when you are moving fast.',
      `The final review can be systematic: ${CORE_LOOP_LABEL.toLowerCase()}. That loop is the habit.`,
    ],
  },
] as const
