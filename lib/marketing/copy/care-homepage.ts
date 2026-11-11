import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { HOMEPAGE_CHECK_COVERAGE } from './check-coverage'
import { PRODUCT_STORY } from './product-story'

/** Homepage examples are illustrative. Captures and illustrations are distinguished in context. */
const EXAMPLE_HOST = 'Everyday Goods'
const CART_EXAMPLE = {
  title: 'Add to cart didn’t add the product',
  observed: 'The Add to cart button responds, but the selected product does not appear in the cart.',
  expected: 'The product appears in the cart and checkout can be opened.',
  fix: 'Fix the cart update, then verify the selected product and quantity and confirm checkout can be opened.',
  prompt: 'Sample Flag: the Add to cart button responds, but the selected product does not appear in the cart. Fix the cart update, verify the product and quantity, then confirm checkout can be opened. Stop before submitting payment or placing an order.',
} as const

export const CARE_HOME = {
  signIn: 'Sign in',
  hero: {
    headline: PRODUCT_STORY.headline,
    body: PRODUCT_STORY.lede,
    eyebrow: 'Open beta',
    setup: PRODUCT_STORY.setup,
    cta: PRODUCT_STORY.action,
    sampleAction: 'Try the interactive sample',
    sampleHref: '/how-it-works#sample',
    placeholder: 'yourwebsite.com',
  },
  boardLabel: 'www.examplesites.com',
  boardAria: `${EXAMPLE_HOST} board`,
  monitoring: {
    history: [
      { label: '10 Sep', flagCount: 0 },
      { label: '11 Sep', flagCount: 0 },
      { label: '12 Sep', flagCount: 0 },
      { label: '13 Sep', flagCount: 0 },
      { label: '14 Sep', flagCount: 3 },
    ],
    timeline: [
      { id: 'check-14', title: 'Check completed', time: '14 Sep · 09:00', state: 'attention', flagCount: 3, flags: [
        { id: 'availability', title: 'Pricing page is not loading' },
        { id: 'contact', title: 'Contact page loads too slowly' },
        { id: 'checkout', title: CART_EXAMPLE.title },
      ] },
      { id: 'check-13', title: 'Check completed', time: '13 Sep · 09:00', state: 'healthy', flagCount: 0 },
      { id: 'check-12', title: 'Check completed', time: '12 Sep · 09:00', state: 'healthy', flagCount: 0 },
      { id: 'check-11', title: 'Check completed', time: '11 Sep · 09:00', state: 'healthy', flagCount: 0 },
      { id: 'check-10', title: 'Check completed', time: '10 Sep · 09:00', state: 'healthy', flagCount: 0 },
    ],
  },
  checks: HOMEPAGE_CHECK_COVERAGE,
  builtForAi: {
    label: 'Built for your AI',
    titleLines: ['Your AI fixes.', 'FixFlags checks.'] as const,
    body: 'Every Flag comes with fix instructions written for your AI: the page, what happened, what should happen, and how to confirm it.',
    cardLabel: 'Fix instructions',
    sampleLabel: 'Sample',
    copy: 'Copy fix instructions',
    waysLabel: 'Hand it off your way',
    ways: [
      { id: 'paste', title: 'Copy and paste', body: 'One fix, or all of them at once, into the AI you build with.' },
      { id: 'agent', title: 'Connect your agent', body: 'Over MCP, your agent reads your Flags and asks FixFlags to recheck when it’s done.', action: 'Connect with MCP', href: '/connect-ai' },
      { id: 'record', title: 'Linked to the full record', body: 'Every fix points back to its Flag, so a connected agent can read the evidence itself.' },
    ],
    toolsLabel: 'AI tools',
    guideAction: (tool: string) => `Using FixFlags with ${tool}`,
    tools: [
      { key: 'lovable', label: 'Lovable' },
      { key: 'bolt', label: 'Bolt' },
      { key: 'replit', label: 'Replit' },
      { key: 'cursor', label: 'Cursor' },
      { key: 'claude-code', label: 'Claude Code' },
    ],
    reasons: [
      { id: 'tokens', title: 'Save your building tokens', body: 'Checks run in FixFlags, not in your AI tool. Your AI gets one clear problem, not a “check everything” prompt.' },
      { id: 'proof', title: 'A second pair of eyes', body: 'Your AI saying it worked isn’t proof. We recheck the live site and show you the result.' },
    ],
  },
  compare: {
    label: 'How it compares',
    titleLines: ['Not another', 'score report.'] as const,
    items: [
      { title: 'Not a page score', body: 'Scanners grade pages. FixFlags tries what visitors do, like opening pages and adding to cart, and tells you what broke.' },
      { title: 'Not session replay', body: 'No tracking tag and no traffic needed. Your first check works on launch day.' },
      { title: 'Not just uptime', body: 'A page can load while checkout fails. FixFlags checks the steps, not only the response.' },
    ],
    action: 'See everything we check',
  },
  workflow: {
    instructions: CART_EXAMPLE.prompt,
  },
  notifications: {
    label: 'After launch',
    titleLines: ['Ship all day.', 'We keep watching.'] as const,
    body: 'Scheduled checks and uptime keep an eye on your live site, so you can keep shipping.',
    alertsLabel: 'Email when',
    alerts: ['Something breaks', 'A fix is confirmed', 'A fixed problem comes back'],
    /** A sample fortnight of daily checks on the example site, oldest first. */
    watch: {
      schedule: 'Daily checks',
      from: '14 days ago',
      to: 'Today',
      checks: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'flag', 'verified', 'ok', 'ok', 'ok'] as const,
      events: [
        { kind: 'flag', when: 'Tue 09:00', text: 'Pricing page is not loading' },
        { kind: 'verified', when: 'Wed 09:00', text: 'Fixed and verified on the live site' },
      ] as const,
    },
    detailTitle: 'What gets checked?',
    detailBody: 'Save your website to start scheduled checks. You can see what’s checked, change the schedule, and choose your email alerts in Settings. New problems can be found at the next scheduled check.',
    sampleLabel: 'Example email · Sample data',
    sender: 'FixFlags',
    host: 'www.examplesites.com',
    flag: 'Pricing page is not loading',
    action: 'Explore the sample Flag',
  },
  close: { titleLines: ['Check your website', 'before your visitors do.'] as const, title: 'Check your website before your visitors do.', body: 'Start free. Nothing to install.', pricing: 'What’s included for free' },
} as const

/** Illustrative analysis snapshot, not a customer assessment or live schedule. */
export type SampleCategory = {
  id: import('@/lib/sites/card-areas').SiteCardArea
  name: string
  state: import('@/lib/sites/card-areas').CardHealthState
  answer: string
  context: string
  status: string
  flagCount: number
  scope: string
  checkedAt: string | null
  results: readonly { label: string; status: string; detail: string; flag?: SampleFlagId; capture?: { src: string; alt: string } }[]
  flag?: 'availability' | 'checkout'
  flags?: readonly SampleFlagId[]
  connection?: { label: string; body: string; href: string }
}

export type SampleFlagId = 'availability' | 'contact' | 'checkout'

export function sampleFlagsForCategory(card: SampleCategory): SampleFlagId[] {
  return [...(card.flags ?? (card.flag ? [card.flag] : []))]
}

/** Sample result labels for checks the sample did not run or could not finish. */
const COULD_NOT_VERIFY = 'Couldn’t verify'
const NOT_CHECKED = 'Not checked'

export const HOMEPAGE_SAMPLE = {
  sampleLabel: 'Interactive dashboard · Sample data',
  identityAlt: 'Everyday Goods sample homepage, shown for website identity',
  title: 'See what needs attention.',
  subtitle: 'Try the sample. Open a problem and copy the fix instructions.',
  freshness: '15 minutes ago',
  summaryLabel: 'Sample website status',
  navigationLabel: 'Sample navigation',
  navigation: { site: 'Overview', timeline: 'Timeline', integrations: 'Integrations', settings: 'Settings' },
  summaryItems: [
    { value: 3, label: 'Flags', state: 'attention' },
    { id: 'pages', value: 12, label: 'Pages checked', detail: '3 need attention', state: 'attention' },
    { id: 'monitoring', value: 'Monitoring', label: 'Daily', detail: 'Next in 23h 45m', accessibleDetail: 'Next check in 23 hours and 45 minutes', state: 'healthy' },
  ],
  technologies: [
    { name: 'Shopify', status: 'Detected', state: 'healthy' },
    { name: 'Next.js', status: 'Detected', state: 'healthy' },
    { name: 'Google Analytics', status: 'Detected', state: 'healthy' },
    { name: 'Stripe', status: 'Detected', state: 'healthy' },
  ],
  guidanceAction: 'How to use the instructions',
  observedLabel: 'What happened',
  expectedLabel: 'What should happen',
  availabilityTitle: 'Pricing page is not loading',
  availabilityObserved: 'The pricing page returned 404.',
  availabilityExpected: 'The pricing page opens.',
  availabilityFix: 'Restore the /pricing route and its content, then verify that the same URL responds successfully.',
  availabilityPrompt: 'FixFlags sample Flag: /pricing returns HTTP 404. Restore the route and pricing content. After publishing, request a fresh independent check of /pricing and confirm a successful response. Copying this prompt does not resolve a Flag.',
  availabilityAlt: 'Pricing page showing a 404 response',
  guidanceCopied: 'Fix instructions copied.',
  copyFailed: 'Couldn’t copy automatically. Select and copy the instructions below.',
  sampleCopy: 'Copy fix instructions',
  connections: 'Connections add information. A new website check confirms whether a fix worked.',
  sources: { http: 'https://everydaygoods.example/pricing' },
  guidanceLabel: 'Fix instructions',
  availabilityScope: '/pricing · public page response',
  couldNotVerify: COULD_NOT_VERIFY,
  notChecked: NOT_CHECKED,
  categories: [
    { id: 'site', name: CARD_CATALOG.site.name, state: 'problem', answer: '2 pages need attention', context: '12 pages scanned', status: '2 Flags', flagCount: 2, flag: 'availability', flags: ['availability', 'contact'],
      scope: '12 public pages, including the homepage, product pages, and pricing.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: '/pricing', status: 'Flag', flag: 'availability', detail: 'The pricing page returned a 404 (page not found) error.', capture: { src: '/marketing/evidence/pricing-unavailable.png', alt: 'Pricing page showing a 404 response' } }, { label: '/contact', status: 'Flag', flag: 'contact', detail: 'The contact page took 4.2 seconds to show its main content on mobile.' }, { label: '10 other pages', status: 'Checked', detail: 'The other public pages opened successfully.' } ] },
    { id: 'conversion', name: CARD_CATALOG.conversion.name, state: 'problem', answer: CART_EXAMPLE.title, context: 'Add to cart · 0 items in the cart', status: '1 Flag', flagCount: 1, flag: 'checkout',
      scope: 'Product → Add to cart → cart → checkout entry. No payment or real order.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Add to cart', status: 'Flag', detail: CART_EXAMPLE.observed }, { label: 'Signup', status: COULD_NOT_VERIFY, detail: 'Signup needs a test account you set up before we can check it.' } ],
      connection: { label: 'Shopify', body: 'The Shopify connection is coming soon. This check works without it.', href: '/docs/integrations/shopify' } },
    { id: 'security', name: CARD_CATALOG.security.name, state: 'healthy', answer: 'Pages use HTTPS', context: 'Public protections', status: '0 Flags', flagCount: 0,
      scope: 'Sample HTTPS check on public pages. This is not a full security test.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'HTTPS', status: 'Checked', detail: 'The sample pages load over a secure HTTPS connection.' }, { label: 'Server security', status: NOT_CHECKED, detail: 'A browser visit can’t see how your server is secured.' } ] },
    { id: 'search', name: CARD_CATALOG.search.name, state: 'healthy', answer: 'Search engines can access checked pages', context: 'Homepage and product page', status: '0 Flags', flagCount: 0,
      scope: 'Sample page titles and search access for the homepage and product page. Rankings aren’t checked.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Page titles', status: 'Checked', detail: 'Both sample pages have descriptive titles.' }, { label: 'Search access', status: 'Checked', detail: 'Search engines are allowed to read the sample pages.' }, { label: 'Search rankings', status: NOT_CHECKED, detail: 'A page search engines can read may still rank low.' } ],
      connection: { label: 'Google Search Console', body: 'The Search Console connection is coming soon. Search checks work without it.', href: '/docs/integrations/google-search-console' } },
    { id: 'performance', name: CARD_CATALOG.performance.name, state: 'healthy', answer: 'Main content loads in 1.8s', context: 'Mobile and desktop', status: '0 Flags', flagCount: 0,
      scope: 'Sample loading times for the homepage and product page on mobile and desktop.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Mobile', status: 'Checked', detail: 'Main content loaded in 1.8 seconds.' }, { label: 'Desktop', status: 'Checked', detail: 'Main content loaded in 1.1 seconds.' } ] },
    { id: 'tracking', name: CARD_CATALOG.tracking.name, state: 'healthy', answer: 'Product view event observed', context: 'Public browser event', status: '0 Flags', flagCount: 0,
      scope: 'Sample product-view event seen in the browser. Whether it reached your analytics account isn’t checked.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Product view', status: 'Checked', detail: 'The sample product page sent a view event.' }, { label: 'Analytics delivery', status: NOT_CHECKED, detail: 'Seeing an event in the browser does not prove it reached an analytics account.' } ],
      connection: { label: 'Google Analytics', body: 'The Analytics connection is coming soon. Visit counts can’t confirm that a button works.', href: '/docs/integrations/google-analytics' } },
    { id: 'accessibility', name: CARD_CATALOG.accessibility.name, state: 'healthy', answer: 'Buttons and fields are labeled', context: 'Automated checks · 2 pages', status: '0 Flags', flagCount: 0,
      scope: 'Sample automated checks on the homepage and product page. A person still needs to review accessibility.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Button and field labels', status: 'Checked', detail: 'Screen readers can announce the buttons and fields on the sample pages.' }, { label: 'Human review', status: NOT_CHECKED, detail: 'Automated checks can’t confirm a page is fully accessible.' } ] },
    { id: 'uptime', name: CARD_CATALOG.uptime.name, state: 'healthy', answer: 'Website is reachable', context: 'Scheduled reachability checks', status: '0 Flags', flagCount: 0,
      scope: 'Sample results from five scheduled checks.', checkedAt: '2026-09-14T09:00:00Z',
      results: [{ label: 'Public website', status: 'Checked', detail: 'The website responded in each of the five sample checks.' }] },
  ] as readonly SampleCategory[],
} as const

/** Crafted issues for the illustrative board, not a live customer scan. */
export const SAMPLE_FLAGS = {
  availability: { title: HOMEPAGE_SAMPLE.availabilityTitle, observed: HOMEPAGE_SAMPLE.availabilityObserved, expected: HOMEPAGE_SAMPLE.availabilityExpected, fix: HOMEPAGE_SAMPLE.availabilityFix, prompt: HOMEPAGE_SAMPLE.availabilityPrompt, page: '/pricing', url: HOMEPAGE_SAMPLE.sources.http, scope: HOMEPAGE_SAMPLE.availabilityScope, image: '/marketing/evidence/pricing-unavailable.png', imageAlt: HOMEPAGE_SAMPLE.availabilityAlt },
  contact: { title: 'Contact page loads too slowly', observed: 'Main content took 4.2 seconds to appear on mobile.', expected: 'The contact page shows its main content within 2.5 seconds.', fix: 'Reduce the resources delaying the main content on /contact, then measure it again on mobile.', prompt: 'FixFlags illustrative Flag: /contact took 4.2 seconds to render its main content on mobile. Inspect the loading waterfall and render-blocking resources, improve the page, then request a fresh mobile measurement. Target Largest Contentful Paint of 2.5 seconds or less.', page: '/contact', url: 'https://everydaygoods.example/contact', scope: '/contact · mobile loading time', image: null, imageAlt: null },
  checkout: { ...CART_EXAMPLE, page: '/products/canvas-tote', url: 'https://everydaygoods.example/products/canvas-tote', scope: '/products/canvas-tote · Add to cart', image: null, imageAlt: null },
} satisfies Record<SampleFlagId, { title: string; observed: string; expected: string; fix: string; prompt: string; page: string; url: string; scope: string; image: string | null; imageAlt: string | null }>

/** Named pages in the illustrative twelve-page sample, never customer scan data. */
export const SAMPLE_CHECKED_PAGE_PATHS = ['/pricing', '/contact', '/', '/products/canvas-tote', '/products', '/collections', '/collections/everyday', '/about', '/shipping', '/returns', '/faq', '/privacy'] as const
