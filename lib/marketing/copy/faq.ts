import { CORE_LOOP_LABEL } from './terminology'

export const FAQ_SECTION = {
  title: 'Common questions',
  viewAll: 'View all questions',
  label: 'FAQ',
} as const

export const FAQ_PAGE = {
  title: 'Frequently asked questions',
  subhead:
    'How FixFlags walks the Shopify purchase path, what Can buy and Can\'t buy mean, and what is free.',
} as const

export type FaqEntry = {
  question: string
  answer: string
  learnMore?: { href: string; label: string }
}

export const FAQ: readonly FaqEntry[] = [
  {
    question: 'What does FixFlags actually check?',
    answer:
      'FixFlags walks the purchase path on a phone-sized browser: product, add to cart, cart, checkout. It tells you whether a stranger can still buy. It is not an uptime ping, a Lighthouse score, or a recording of real shoppers.',
    learnMore: { href: '/help/checks-and-reports/vs-lighthouse', label: 'Walk vs uptime' },
  },
  {
    question: 'What do Can buy, Can\'t buy, and Unclear mean?',
    answer:
      'Can buy means a stranger reached checkout and we stopped before payment. Can\'t buy means the path failed twice on independent walks. Unclear means we could not prove it: a bot wall, password gate, missing buy button, or a flake. Unclear stays in the app. We do not email Unclear.',
    learnMore: { href: '/help/checks-and-reports/scores-and-severity', label: 'Path health' },
  },
  {
    question: 'Do you charge or complete checkout?',
    answer:
      'No. The walk stops when checkout or Shop Pay is visible. We never enter payment details or place an order. The Shopify app is free to install. Pro extras are on a waitlist. We are not charging yet.',
    learnMore: { href: '/help/billing-and-plans/free-vs-pro', label: 'Free vs Pro' },
  },
  {
    question: 'What is included for free?',
    answer:
      'One Shopify store, one or two auto-discovered buyable products, a mobile walk with video, email on confirmed Can\'t buy and recovery, optional Slack, and five manual rechecks per day. Walks run about every six hours.',
    learnMore: { href: '/help/billing-and-plans/what-counts-as-a-check', label: 'What the free plan includes' },
  },
  {
    question: 'When do you email or Slack me?',
    answer:
      'Only after a path is confirmed broken on two walks, and again when that path can take orders. The message includes a proof link. Unclear stays in the app. Improve items never go in alerts.',
    learnMore: { href: '/help/account/report-privacy', label: 'Alerts and proof' },
  },
  {
    question: 'What if my store is password gated or has no products yet?',
    answer:
      'We show an honest state in the app. Publish an active product with a storefront URL, or remove the password from the storefront you want watched. We do not guess a buy path that is not there.',
    learnMore: { href: '/help/checks-and-reports/public-urls-only', label: 'Storefront access' },
  },
  {
    question: 'Can I watch what FixFlags saw?',
    answer:
      'Yes. Each walk keeps video of our session, or a GIF of the key steps if video encoding fails, plus step screenshots. This is our walk, not session replay of your customers.',
    learnMore: { href: '/help/checks-and-reports/evidence-and-screenshots', label: 'Watch verification' },
  },
  {
    question: 'How do I recheck after I fix the theme or an app?',
    answer:
      'Open the path and choose Recheck. Free stores get five manual rechecks per day. Scheduled walks continue on their own.',
    learnMore: { href: '/help/getting-started/flag-fix-recheck', label: 'Recheck a path' },
  },
  {
    question: 'How do I start using FixFlags?',
    answer:
      'Install on Shopify. We discover buyable products from your catalog. The public site does not ask you to paste a website.',
    learnMore: { href: '/help/getting-started/first-check', label: 'Install on Shopify' },
  },
  {
    question: 'Who is FixFlags for?',
    answer:
      'Shopify store owners who need to know the buy path still works. Store up is not the same as can buy.',
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
      'Billing shows how many product reviews you have used this month, including update reviews and Watch',
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
      'Run free product reviews on any live or preview URL',
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
