import { OFFER, SCORE_HELP, SEVERITY_MEANINGS } from './brand'

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
    answer:
      'Yes. Your report opens in scanning mode immediately, then asks you to create a free account or sign in while the check runs. Free includes 3 new URL checks with full reports and unlimited re-checks on reports you own.',
  },
  {
    question: 'What\u2019s included in the free plan vs Pro?',
    answer:
      'Free: 3 new URL checks with full reports and fix prompts, plus unlimited re-checks on reports you own. Pro: before/after compare, MCP in supported builders, and 5 journeys per month.',
  },
  {
    question: 'Do I need Cursor or MCP?',
    answer:
      'No. MCP is optional on Pro. Fix prompts copy into any editor, ticket, or brief. Lovable and Bolt also connect through custom MCP connectors.',
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
    answer: `${OFFER.linkPrivacy} Studio plans can create public share links. Separate public pages for sites are for discovery; they are not your private audit.`,
  },
  {
    question: 'Does it work on staging/password-protected sites?',
    answer:
      'Yes for preview URLs you can reach over HTTPS (ngrok, Vercel preview, Cloudflare tunnel). On Studio projects, save HTTP basic auth or a session cookie under Projects → Preview access. Localhost and private networks are still not supported.',
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
    slug: 'why-ai-built-sites-need-a-launch-check',
    title: 'Why AI-built sites still need a final review',
    date: '2026-07-02',
    excerpt:
      'AI coding tools move fast, but speed skips the boring checks: dead CTAs, broken previews, missing alt text. Here is why a final review matters before you share the link.',
    body: [
      'AI coding tools are very good at producing a page that looks finished. They are much less good at noticing the things that only show up when someone else actually uses the page: a call-to-action that points nowhere, an Open Graph image that never loads, a form input with no label.',
      'None of these are hard to fix. Almost all of them are invisible until a real user, or a QA pass, goes looking.',
      'That gap is what "finish what your AI started" means in practice. The build gets you 90% of the way. The last 10% is the pass that catches what speed skipped, and it is exactly the kind of checklist work that is easy to automate and easy to skip when you are moving fast.',
      'The final review can be systematic: run the checks, get the Flags, fix what matters, then re-check. That loop is the habit.',
    ],
  },
] as const
