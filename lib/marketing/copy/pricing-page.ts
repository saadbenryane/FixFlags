import { PLANNED_ADD_ON_PRICING as ADD_ON, PLANNED_PAID_PRICING as PAID } from '@/lib/billing/beta-policy'
import type { FaqEntry } from './faq'
import { PRODUCT_STORY } from './product-story'

/**
 * Pricing page: planned per-account pricing (owner decision 2026-11-11).
 * Open beta is free on one website. Paid plans are planned and not on sale.
 * Prices and included websites come from PLANNED_PAID_PRICING in
 * lib/billing/beta-policy.ts. The public offer, Terms, Help and in-app plans
 * derive their pricing words from PRICING_TIERS and PRICING_ADD_ONS here.
 */

/** "1 website", "5 websites". */
export function websitesLabel(count: number): string {
  return `${count} ${count === 1 ? 'website' : 'websites'}`
}

export type PlanFeature = { label: string; planned?: boolean }

export type PricingTier = {
  id: 'free' | 'pro' | 'team' | 'agency'
  name: string
  price: string
  period: string
  /** Websites included in the plan. */
  websites: number
  priceLabel: string
  status: string
  available: boolean
  summary: string
  features: readonly PlanFeature[]
  cta: { label: string; href: string }
}

export const PRICING_TIERS = [
  {
    id: 'free', name: 'Free', price: '$0', period: '', websites: 1, priceLabel: 'During open beta', status: 'Available now', available: true,
    summary: 'Every supported feature and schedule on one website while the beta runs.',
    features: [{ label: websitesLabel(1) }, { label: 'Any check schedule' }, { label: 'A check after every deploy' }, { label: 'Uptime monitoring' }, { label: 'Fix instructions and rechecks' }],
    cta: { label: 'Start free', href: '/sign-up' },
  },
  {
    id: 'pro', name: 'Pro', ...PAID.BUILDER, priceLabel: 'Planned pricing', status: 'Coming soon', available: false,
    summary: 'For one website that needs a daily eye on it.',
    features: [{ label: websitesLabel(PAID.BUILDER.websites) }, { label: 'Daily checks' }, { label: 'Uptime monitoring' }, { label: 'Fix instructions and rechecks' }],
    cta: { label: 'Join Pro waitlist', href: '/waitlist/pro' },
  },
  {
    id: 'team', name: 'Team', ...PAID.TEAM, priceLabel: 'Planned pricing', status: 'Coming soon', available: false,
    summary: 'For teams that publish often across a few websites.',
    features: [{ label: websitesLabel(PAID.TEAM.websites) }, { label: 'Daily checks' }, { label: 'A check after every deploy' }, { label: 'Uptime monitoring' }, { label: 'Fix instructions and rechecks' }],
    cta: { label: 'Join Team waitlist', href: '/waitlist/team' },
  },
  {
    id: 'agency', name: 'Agency', ...PAID.AGENCY, priceLabel: 'Planned pricing', status: 'Coming soon', available: false,
    summary: 'Catch problems on client sites before your clients do.',
    features: [{ label: websitesLabel(PAID.AGENCY.websites) }, { label: 'Daily checks' }, { label: 'A check after every deploy' }, { label: 'Uptime monitoring' }, { label: 'Client reports', planned: true }],
    cta: { label: 'Join Agency waitlist', href: '/waitlist/agency' },
  },
] as const satisfies readonly PricingTier[]

export const PRICING_ADD_ONS = {
  title: 'Add-ons on every plan',
  note: 'Add-ons start when paid plans open.',
  items: [
    { id: 'sites', name: 'Extra websites', ...ADD_ON.extraWebsite },
    { id: 'checks', name: 'Extra checks and rechecks', ...ADD_ON.extraChecks },
  ],
} as const

type PlanCell = { kind: 'yes' } | { kind: 'no' } | { kind: 'planned' } | { kind: 'text'; value: string }
const yes = { kind: 'yes' } as const
const no = { kind: 'no' } as const
const planned = { kind: 'planned' } as const
const text = (value: string) => ({ kind: 'text', value }) as const

export const PRICING_PLAN_TABLE = {
  id: 'compare-plans',
  lines: ['Compare plans.', 'Priced per account.'] as const,
  caption: 'FixFlags plan comparison',
  note: 'During open beta, Free includes every supported feature and schedule on one website. Pro, Team and Agency show planned pricing.',
  notIncluded: 'Not included',
  monitoringLink: { label: 'See how monitoring works', href: '/docs/site-care' },
  rows: [
    { feature: 'Websites', cells: [text('1'), text(String(PAID.BUILDER.websites)), text(String(PAID.TEAM.websites)), text(String(PAID.AGENCY.websites))] },
    { feature: 'Scheduled checks', cells: [text('Any schedule'), text('Daily'), text('Daily'), text('Daily')] },
    { feature: 'Check after every deploy', cells: [yes, no, yes, yes] },
    { feature: 'Uptime monitoring', cells: [yes, yes, yes, yes] },
    { feature: 'Fix instructions and rechecks', cells: [yes, yes, yes, yes] },
    { feature: 'Client reports', cells: [no, no, no, planned] },
  ],
} as const satisfies { rows: readonly { feature: string; cells: readonly PlanCell[] }[] } & Record<string, unknown>

export const PRICING_STORY = {
  title: `${PRODUCT_STORY.loop.join('. ')}.`,
  body: 'Every plan checks your live website in eight areas, shows each problem with evidence, and gives you fix instructions to paste into the tool you build with. A new check confirms the fix.',
  areasLabel: 'Eight areas on every check',
  link: { label: 'See what gets checked', href: '/coverage' },
  compareLink: { label: 'How FixFlags compares', href: '/compare' },
} as const

/** Published findings only, quoted exactly. Sources checked 2026-11-11 (see the investor deck SOURCES.md, v6.3). */
export const PRICING_IMPACT = {
  id: 'why-it-pays',
  label: 'Why it pays',
  lines: ['Slow sites lose people.', 'Faster ones sell more.'] as const,
  stats: [
    {
      value: '+123%', label: 'chance a mobile visitor bounces as load time goes from 1 to 10 seconds',
      quote: 'As page load time goes from one second to 10 seconds, the probability of a mobile site visitor bouncing increases 123%.',
      source: 'Google/SOASTA Research, 2017 (archived copy)',
      href: 'https://web.archive.org/web/20231231141644/https://www.thinkwithgoogle.com/marketing-strategies/app-and-mobile/mobile-page-speed-new-industry-benchmarks/',
    },
    {
      value: '+53.37%', label: 'revenue per visitor on the faster page, tested against the original',
      quote: '53.37% increase in revenue per visitor.',
      source: 'Rakuten 24 on web.dev, 2022',
      href: 'https://web.dev/case-studies/rakuten',
    },
    {
      value: '+13%', label: 'conversions when the main content shows 1 second sooner',
      quote: '1 second LCP improvement can lead to … 13% increase in conversions.',
      source: 'Renault on web.dev, 2021',
      href: 'https://web.dev/case-studies/renault',
    },
  ],
} as const

export const PRICING_PAGE_FAQ: readonly FaqEntry[] = [
  { question: 'What do I get during open beta?', answer: 'All supported features on one website, with no usage limits and any supported monitoring schedule. Checks after every deploy are included.', learnMore: { href: '/help/account-and-billing/free-and-pro', label: 'The beta offer' } },
  { question: 'Are Pro, Team and Agency available now?', answer: `Not yet. All three are coming soon. Planned pricing is ${PAID.BUILDER.price} a month for Pro, ${PAID.TEAM.price} for Team and ${PAID.AGENCY.price} for Agency. Final terms will be confirmed before paid launch. Joining a waitlist does not start a subscription or charge you.`, learnMore: { href: '/waitlist', label: 'Paid plan waitlist' } },
  { question: 'Is pricing per website?', answer: `No. Paid plans are priced per account and include a number of websites: ${PAID.BUILDER.websites} on Pro, ${PAID.TEAM.websites} on Team and ${PAID.AGENCY.websites} on Agency. Extra websites are ${ADD_ON.extraWebsite.price} ${ADD_ON.extraWebsite.unit} on any plan.`, learnMore: { href: '/docs/getting-started', label: 'Getting started' } },
  { question: 'What counts as a check, and what is a recheck?', answer: `One check runs the pages and actions available for your website and setup. It can find several problems and tells you what it couldn’t check. A recheck is a new check after you publish a fix, so you can see whether it worked. Extra checks and rechecks beyond your plan are ${ADD_ON.extraChecks.price} ${ADD_ON.extraChecks.unit}.`, learnMore: { href: '/coverage', label: 'What FixFlags checks' } },
  { question: 'Does uptime count as a check?', answer: 'No. Uptime monitoring is included separately on every plan, including Free.', learnMore: { href: '/coverage#uptime', label: 'Uptime coverage' } },
  { question: 'Can FixFlags check my site after every deploy?', answer: 'Yes. Add one request to your deploy pipeline, from GitHub Actions, Vercel, Netlify or a shell script, and FixFlags checks your live Site after each production deploy, including its open Flags. It is included on Free during open beta and planned for Team and Agency.', learnMore: { href: '/docs/site-care#check-after-every-deploy', label: 'Check after every deploy' } },
  { question: 'What counts as one website?', answer: 'Pages on the same domain count as one website. For example, yourwebsite.com and yourwebsite.com/pricing belong together. A separate subdomain, such as app.yourwebsite.com, counts as another website. Adding www does not make a separate website.', learnMore: { href: '/docs/getting-started', label: 'Getting started' } },
  { question: 'What happens when beta ends?', answer: 'The full-access beta promotion is temporary. We plan to keep a useful Free plan with uptime monitoring. Paid plans add more websites and checks. We’ll tell you before the beta offer changes. Paid plans require you to opt in; there is no automatic charge.', learnMore: { href: '/help/account-and-billing/free-and-pro', label: 'Free and future paid plans' } },
] as const
