import { OFFER, SCORE_HELP, SEVERITY_MEANINGS } from './brand'
import { CORE_LOOP_LABEL, PRICING_COPY } from './terminology'

export const FAQ_SECTION = {
  title: 'Common questions',
  viewAll: 'View all questions',
  label: 'FAQ',
} as const

export const FAQ_PAGE = {
  title: 'Frequently asked questions',
  subhead:
    'Everything you need to know about FixFlags product reviews, Flags, fix prompts, and plans.',
} as const

export type FaqEntry = {
  question: string
  answer: string
  learnMore?: { href: string; label: string }
}

export const FAQ: readonly FaqEntry[] = [
  {
    question: 'What does FixFlags check that Lighthouse doesn\u2019t?',
    answer:
      'Lighthouse scores performance, accessibility, and SEO. FixFlags adds message, experience, and reach review with evidence and fix prompts.',
    learnMore: { href: '/help/checks-and-reports/vs-lighthouse', label: 'FixFlags vs Lighthouse' },
  },
  {
    question: 'How are FixFlags reviews organized?',
    answer:
      'Every report groups Flags into Message, Experience, and Reach. Each Flag includes evidence and a fix prompt.',
    learnMore: { href: '/docs/reports', label: 'Finish Plans and reports' },
  },
  {
    question: 'What does the Message section check?',
    answer:
      'Headline clarity, placeholder copy, dead CTA links, audience fit, and pricing confidence.',
    learnMore: { href: '/docs/reports#flags-and-evidence', label: 'Flags and evidence' },
  },
  {
    question: 'What does the Experience section check?',
    answer:
      'Layout, mobile usability, accessibility basics, Core Web Vitals, and automated CTA click-through.',
    learnMore: { href: '/docs/reports#flags-and-evidence', label: 'Flags and evidence' },
  },
  {
    question: 'What does the Reach section check?',
    answer:
      'SEO metadata, live search and social preview cards, og:image validation, and indexability.',
    learnMore: { href: '/docs/reports#flags-and-evidence', label: 'Flags and evidence' },
  },
  {
    question: 'How are scores calculated?',
    answer: SCORE_HELP.short,
    learnMore: { href: SCORE_HELP.faqHref, label: 'Scores and severity' },
  },
  {
    question: 'What do Critical, Important, and Polish mean?',
    answer: `Critical: ${SEVERITY_MEANINGS.CRITICAL} Important: ${SEVERITY_MEANINGS.IMPORTANT} Polish: ${SEVERITY_MEANINGS.POLISH}`,
    learnMore: { href: SCORE_HELP.faqHref, label: 'Scores and severity' },
  },
  {
    question: 'Do I need an account for my first product review?',
    answer: `No. Your report opens immediately while the product review runs. Free includes ${PRICING_COPY.freeProductReviewsPerMonth} product reviews per month after you sign in.`,
    learnMore: { href: '/help/getting-started/first-check', label: 'Run your first product review' },
  },
  {
    question: 'What\u2019s included in the free plan vs Pro?',
    answer: `Free includes ${PRICING_COPY.freeProductReviewsPerMonth} reviews per month for one product. Pro (${PRICING_COPY.proPrice}${PRICING_COPY.proPeriod}) includes ${PRICING_COPY.proProductReviewsPerMonth} reviews across up to five products. Studio (${PRICING_COPY.studioPrice}${PRICING_COPY.studioPeriod}) includes ${PRICING_COPY.studioProductReviewsPerMonth} reviews per month with unlimited products, scheduled reviews, and a shared workspace.`,
    learnMore: { href: '/help/billing-and-plans/free-vs-pro', label: 'Free vs Pro' },
  },
  {
    question: 'Do I need a specific AI builder?',
    answer:
      'No. Fix prompts copy into Lovable or any other editor, ticket, or brief.',
    learnMore: { href: '/docs/getting-started#fix-the-first-flag', label: 'Fix the first Flag' },
  },
  {
    question: 'Can it review sites built with Lovable/Bolt/v0/Devin?',
    answer:
      'Yes. FixFlags reviews any publicly accessible URL regardless of how it was built.',
    learnMore: { href: '/help/checks-and-reports/public-urls-only', label: 'Public URLs only' },
  },
  {
    question: 'How do fix prompts work with Cursor/Claude?',
    answer:
      'Each Flag includes a fix prompt with specific evidence from your page. Paste it into your AI builder.',
    learnMore: { href: '/docs/reports#fix-prompts', label: 'Fix prompts' },
  },
  {
    question: 'Can I run an update review after my agent fixes Flags?',
    answer:
      'Yes. Update reviews use one product review from your monthly allowance. Before/after comparison is included on every plan.',
    learnMore: { href: '/help/getting-started/flag-fix-recheck', label: 'Flag, fix, and update review' },
  },
  {
    question: 'Are my reports public?',
    answer: OFFER.reportAccess,
    learnMore: { href: '/help/account/report-privacy', label: 'Report access' },
  },
  {
    question: 'Does it work on staging/password-protected sites?',
    answer:
      'FixFlags can review a publicly reachable HTTPS preview URL. Localhost and password-only pages are not supported.',
    learnMore: { href: '/help/checks-and-reports/public-urls-only', label: 'Public URLs only' },
  },
  {
    question: 'We already have a live site. Is this only for pre-launch?',
    answer:
      'No. FixFlags reviews any public page, live or new. You get a prioritized fix list with screenshots.',
    learnMore: { href: '/docs/getting-started', label: 'Getting started' },
  },
  {
    question: 'Who is FixFlags for?',
    answer:
      'Builders shipping with AI tools and teams with a live site that gets traffic but weak conversion.',
    learnMore: { href: '/how-it-works', label: 'How it works' },
  },
] as const

export const CHANGELOG_ENTRIES = [
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
