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

export const FAQ = [
  {
    question: 'What does FixFlags check that Lighthouse doesn\u2019t?',
    answer:
      'Lighthouse scores performance, accessibility, and SEO. FixFlags adds an AI reviewer that reads your screenshots for message, experience, and reach gaps, including trust and credibility signals. Every Flag includes evidence and a fix prompt. Results are grouped into three sections: Message, Experience, and Reach.',
  },
  {
    question: 'How are FixFlags reviews organized?',
    answer:
      'Every report groups Flags into three sections. Message covers copy and positioning. Experience covers layout, usability, and performance. Reach covers SEO metadata and link previews. Each Flag includes evidence and a fix prompt your agent can run.',
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
    question: 'Do I need an account for my first product review?',
    answer: `Yes. Your report opens immediately while the product review runs. If you are signed out, create a free account or sign in to save it. Free includes ${PRICING_COPY.freeProductReviewsLifetime} product reviews (lifetime) and ${PRICING_COPY.freeDeepReviewTeaserLifetime} deep review teaser.`,
  },
  {
    question: 'What\u2019s included in the free plan vs Pro?',
    answer: `Free: ${PRICING_COPY.freeProductReviewsLifetime} product reviews (lifetime) with full reports and fix prompts, plus ${PRICING_COPY.freeDeepReviewTeaserLifetime} deep review teaser. Update reviews use the same product review credits. Pro (${PRICING_COPY.proPrice}${PRICING_COPY.proPeriod}): before/after compare, ${PRICING_COPY.proProductReviewsPerMonth} product reviews and ${PRICING_COPY.proDeepReviewsPerMonth} deep reviews per month.`,
  },
  {
    question: 'Do I need a specific AI builder?',
    answer:
      'No. Fix prompts copy into Lovable or any other editor, ticket, or brief.',
  },
  {
    question: 'Can it review sites built with Lovable/Bolt/v0/Devin?',
    answer:
      'Yes. FixFlags reviews any publicly accessible URL regardless of how it was built. Fix prompts are tuned for Cursor, Claude Code, Lovable, Bolt, and Devin.',
  },
  {
    question: 'How do fix prompts work with Cursor/Claude?',
    answer:
      'Each Flag includes a fix prompt with specific evidence from your page. Paste it into your AI builder and it knows exactly what to fix.',
  },
  {
    question: 'Can I run an update review after my agent fixes Flags?',
    answer:
      'Yes. Update reviews on reports you own use one product review credit. Pro adds before/after compare.',
  },
  {
    question: 'Are my reports public?',
    answer: `${OFFER.linkPrivacy} Studio plans can create public share links. Separate public site pages are for discovery; they are not your private report.`,
  },
  {
    question: 'Does it work on staging/password-protected sites?',
    answer:
      'Yes for preview URLs you can reach over HTTPS (ngrok, Vercel preview, Cloudflare tunnel). On Studio projects, save HTTP basic auth or a session cookie under Projects → Preview access. Localhost and private networks are still not supported.',
  },
  {
    question: 'We already have a live site. Is this only for pre-launch?',
    answer:
      'No. FixFlags reviews any public page, live or new. You get a prioritized fix list with screenshots, not another performance score.',
  },
  {
    question: 'Who is FixFlags for?',
    answer:
      'Builders shipping with AI tools like Cursor, Lovable, Bolt, and Devin, and teams with a live site that gets traffic but weak conversion. Not for enterprise QA suites or password-only staging.',
  },
] as const

export const CHANGELOG_ENTRIES = [
  {
    date: '2026-07-22',
    title: 'A complete Fix list and safer sharing',
    items: [
      'Every report now opens with every unresolved Flag ranked by launch impact',
      'Screenshots, evidence, and fixes now share one report workspace',
      'The sample shows the same complete Fix list without a loading gap',
      'Password-protected share links stay private and can be revoked without exposing the report',
      'Sign-in waits until your anonymous report is safely attached to your account',
    ],
  },
  {
    date: '2026-07-20',
    title: 'Report depth and Help Center',
    items: [
      'Product Contract and Action Timeline show what we inferred and how we checked',
      'Funnel and CTA flow evidence on Pro reports',
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
