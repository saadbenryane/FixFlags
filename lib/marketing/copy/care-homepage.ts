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

export type HomepageAudienceKey = 'website' | 'store' | 'webapp'

export const WEBSITE_PROMISE = PRODUCT_STORY.description

export const CARE_HOME = {
  brand: 'FixFlags', signIn: 'Sign in',
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
  boardHost: EXAMPLE_HOST,
  boardLabel: 'www.examplesites.com',
  boardSummary: '3 Flags · 12 pages detected',
  exampleCheckedAt: '2026-09-14T09:00:00.000Z',
  boardAria: `${EXAMPLE_HOST} board`,
  details: { flagsLabel: 'Flags in this category' },
  site: {
    label: CARD_CATALOG.site.name,
    status: '2 Flags',
    answer: '2 pages need attention',
    imageAlt: 'Everyday Goods store with a Canvas Tote product page',
    question: CARD_CATALOG.site.question,
    facts: ['Pricing page: 404 Not Found', 'Contact page: main content took 4.2 seconds', '10 other public pages opened'],
    coverage: 'The sample Site names the unavailable page and the public pages included in the latest analysis.',
  },
  flag: {
    name: CARD_CATALOG.conversion.name,
    status: '1 Flag',
    title: 'Checkout is unavailable',
    body: 'The product page opened, but checkout returned an error.',
    outcome: 'Reach checkout from the product page',
    action: 'See the Flag',
    cropAlt: 'Canvas Tote product page where Add to cart leaves the cart empty',
    facts: [
      'Page: /products/canvas-tote',
      'Action: select Add to cart',
      'Observed: the button responds but the cart remains empty',
    ],
    question: CARD_CATALOG.conversion.question,
  },
  cards: [
    { id: 'security', name: CARD_CATALOG.security.name, value: 'HTTPS protections checked', detail: 'HTTPS and key protections are in place', status: 'Clear', tone: 'good', chart: 'none',
      question: CARD_CATALOG.security.question, answer: 'Protected',
      facts: ['HTTPS is on', 'The certificate is valid', 'No mixed content'],
      coverage: 'HTTPS, certificate, and mixed-content checks on the pages explored.' },
    { id: 'search', name: CARD_CATALOG.search.name, value: '12 pages can be crawled', detail: 'Checked pages can be found and crawled', status: 'Clear', tone: 'good', chart: 'none',
      question: CARD_CATALOG.search.question, answer: '12 pages can be crawled',
      facts: ['Checked pages allow search-engine access', 'This is crawlability, not a ranking claim'],
      coverage: 'Crawlability only. Rankings require separate search-performance data.' },
    { id: 'performance', name: CARD_CATALOG.performance.name, value: '3.1s', detail: 'Main content is slow on the campaign page', status: '1 Flag', tone: 'attention', chart: 'none',
      question: CARD_CATALOG.performance.question, answer: '3.1s for main content',
      facts: ['Largest Contentful Paint on the homepage', 'People may wait before they can use the page'],
      coverage: 'A live result identifies the page, device, and capture conditions.' },
    { id: 'tracking', name: CARD_CATALOG.tracking.name, value: 'Tracking observed', detail: 'Public events appeared in the browser', status: 'Clear', tone: 'good', chart: 'bars',
      question: CARD_CATALOG.tracking.question, answer: 'Public events were observed',
      facts: ['Expected public events were observed', 'A missing expected event can become a Flag'],
      coverage: 'A live card names the events and observation window.' },
  ],
  library: {
    uptime: {
      id: 'uptime', name: CARD_CATALOG.uptime.name, value: 'Reachable',
      detail: 'The website responded each time we checked', status: 'Clear',
      question: CARD_CATALOG.uptime.question, answer: 'Reachable',
      facts: ['Checked from the public internet', 'No downtime in the observed window'],
      coverage: 'A live card names the observation window and last success.',
    },
    accessibility: {
      id: 'accessibility', name: CARD_CATALOG.accessibility.name, value: 'Essentials checked',
      detail: 'Labels, keyboard access, and contrast on opened pages', status: 'Clear',
      question: CARD_CATALOG.accessibility.question, answer: 'Essentials checked',
      facts: ['Automated checks on public pages', 'Does not replace a human review'],
      coverage: 'Automated accessibility coverage is limited to what the browser can observe.',
    },
  },
  conversionFlags: [
    { id: 'checkout-flag', title: 'Checkout is unavailable', href: '#flag-example' },
  ],
  performanceFlags: [{ id: 'perf-1', title: 'Campaign page is slow', href: '#sample' }],
  monitoring: {
    label: 'Daily monitoring active',
    summary: 'Pricing page, contact page, and checkout',
    action: 'See what’s watched',
    detailTitle: 'What FixFlags keeps checking',
    sample: 'Sample monitoring · 14 Sep 2026',
    cadence: 'Daily checks', next: 'Next check', nextValue: '15 Sep · 09:00 UTC', last: 'Last checked',
    rows: [
      { name: 'Does the pricing page open?', scope: '/pricing · public page availability', status: '1 Flag', state: 'problem', last: '14 Sep · 09:00 UTC' },
      { name: 'Does the contact page open?', scope: '/contact · public page availability', status: '1 Flag', state: 'problem', last: '14 Sep · 09:00 UTC' },
      { name: 'Can customers reach checkout?', scope: 'Product → cart → checkout. No payment or order.', status: '1 Flag', state: 'problem', last: '14 Sep · 09:00 UTC' },
    ],
    unconfiguredTitle: 'Signup is not being watched',
    unconfiguredBody: 'Set up a synthetic test account in Settings to check signup. Automatic account checks are coming soon.',
    notScheduled: 'Not scheduled',
    note: 'Scheduled checks can find problems at the next check, not the moment they happen. The other analysis areas have their own scope and check times.',
    setup: 'FixFlags checks supported website behavior automatically. This sample schedule does not run from this page; your available schedule depends on your plan.',
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
    title: 'Your AI fixes. FixFlags checks.',
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
    title: 'Not another score report.',
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
    title: 'Keep watching after launch.',
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
  coverage: {
    label: 'What FixFlags watches',
    title: 'Check the things your visitors use.',
    body: 'From opening a page to adding a product to the cart, see which steps we can check on your live website.',
    analysisLabel: 'Also checked',
    analysis: ['Performance', 'Accessibility', 'Search', 'Security', 'Tracking', 'Layout'],
    boundary: 'Signup is checked with a synthetic test account you authorize in Settings. Automatic account checks, including signed-in pages, are coming soon.',
    setupNote: 'Public-page analysis needs no installation. Additional account and signup coverage depends on supported behavior and any required authorization.',
    audiences: [
      {
        id: 'website', label: 'Website', question: 'Is the site reachable?', monitored: 'Public page availability',
      },
      {
        id: 'store', label: 'Store', question: 'Can customers buy?', monitored: 'Product → cart → checkout',
      },
      {
        id: 'webapp', label: 'Web app', question: 'Can people sign up?', monitored: 'Configured signup → confirmation',
      },
    ] satisfies ReadonlyArray<{ id: HomepageAudienceKey; label: string; question: string; monitored: string }>,
  },
  actions: {
    label: 'Easy fixes',
    title: 'Fix instructions, ready to paste.',
    body: 'The page, the problem, and what needs to change, ready to copy.',
    promptLabel: 'Example fix instructions',
    promptTitle: 'Pricing page won’t open.',
    promptFacts: [
      { label: 'Page', value: '/pricing' },
      { label: 'The problem', value: 'The pricing page shows a page-not-found error.' },
      { label: 'What should happen', value: 'The pricing page opens with its content.' },
    ],
    editorLabel: 'Paste into the tool you already use',
    editorGuidesLabel: 'Guides for your website tool',
    guidanceAction: 'See how to use the instructions',
    packet: [
      { label: 'Journey', value: 'Complete a purchase' },
      { label: 'Observed', value: 'Add to cart left the cart empty' },
      { label: 'Expected', value: 'The product appears and checkout opens' },
    ],
    choices: [
      { id: 'read', title: 'See the problem', body: 'See the page, what went wrong, and how we found it.', action: 'Open details' },
      { id: 'share', title: 'Ask someone to help', body: 'Copy the details for a teammate or developer.', action: 'Copy details' },
      { id: 'ai', title: 'Copy and paste the fix', body: 'Get instructions to paste where you built your website.', action: 'Copy fix instructions' },
    ],
    copied: 'Flag copied', copyFailed: 'Copy was unavailable. Open the Flag to use the details.',
    hide: 'Hide details', verify: 'Marked fixed only after a new check confirms the same shopping steps work.',
  },
  integrations: {
    label: 'Integrations',
    title: 'Start with your website. That’s it.',
    body: 'No installation or connection needed for public pages. Optional connections are listed below.',
    detailsAction: 'See the connections',
    center: 'Independent checks',
    add: 'Add integration',
    addTitle: 'Add an integration',
    addBody: 'These connections are coming soon. They’ll add information about your website. We’ll still check the website itself to confirm a fix.',
    sampleNote: 'Illustrative integration evidence. GitHub is available; other connections are coming soon.',
    addAction: 'Add',
    added: 'Added',
    action: 'Explore integrations',
  },
  close: { titleLines: ['Check your website', 'before your visitors do.'] as const, title: 'Check your website before your visitors do.', body: 'See what’s broken, hand your AI the fix, and prove it worked. Start free.', pricing: 'What’s included for free' },
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

export const HOMEPAGE_SAMPLE = {
  exploreAction: CARE_HOME.hero.sampleAction, sampleLabel: 'Interactive dashboard · Sample data',
  identityAlt: 'Everyday Goods sample homepage, shown for website identity',
  title: 'See what needs attention.',
  subtitle: 'Try the sample. Open a problem and copy the fix instructions.',
  summary: '3 Flags',
  freshness: '15 minutes ago',
  boardAction: 'Recheck',
  summaryLabel: 'Sample website status',
  navigationLabel: 'Sample navigation',
  navigation: { site: 'Overview', timeline: 'Timeline', integrations: 'Integrations', settings: 'Settings' },
  flagsTitle: 'Flags to fix',
  allAreas: 'All areas',
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
  integrations: [
    { name: 'Shopify', detail: 'Store and product context', status: 'Coming soon', state: 'attention' },
    { name: 'Google Analytics', detail: 'Planned audience context. Connection setup is coming soon.', status: 'Coming soon', state: 'attention', suggested: true },
    { name: 'Google Search Console', detail: 'Planned search context. Connection setup is coming soon.', status: 'Coming soon', state: 'attention', suggested: true },
  ],
  analyzeAction: 'Check your website',
  resultsTitle: 'Results in this area',
  evidenceAction: 'What we checked and found',
  detailAction: 'View Flag',
  fixTitle: 'Fix instructions',
  fixBody: 'Copy these instructions and paste them where you built your website.',
  guidanceAction: 'How to use the instructions',
  observedLabel: 'What happened',
  expectedLabel: 'What should happen',
  scopeLabel: 'What was checked',
  proofTitle: 'After the fix',
  proofBody: 'A new check reached checkout after the fix. No payment or order was made.',
  availabilityTitle: 'Pricing page is not loading',
  availabilityObserved: 'The pricing page returned 404.',
  availabilityExpected: 'The pricing page opens.',
  availabilityFix: 'Restore the /pricing route and its content, then verify that the same URL responds successfully.',
  checkoutFix: 'Restore checkout, publish the change, then ask FixFlags to check it again.',
  availabilityPrompt: 'FixFlags sample Flag: /pricing returns HTTP 404. Restore the route and pricing content. After publishing, request a fresh independent check of /pricing and confirm a successful response. Copying this prompt does not resolve a Flag.',
  availabilityAlt: 'Pricing page showing a 404 response',
  unresolved: 'Run a fresh check after publishing the fix.',
  guidanceCopied: 'Fix instructions copied.',
  copyFailed: 'Couldn’t copy automatically. Select and copy the instructions below.',
  sampleCopy: 'Copy fix instructions',
  connections: 'Connections add information. A new website check confirms whether a fix worked.',
  recoveryAction: 'View sample recovery',
  sources: { http: 'https://everydaygoods.example/pricing', browser: 'https://everydaygoods.example/products/canvas-tote', diagnostics: 'Illustrative diagnostic results' },
  guidanceLabel: 'Fix instructions',
  availabilityScope: '/pricing · public page response',
  checkoutExpected: 'Checkout opens with the selected product. No payment or order is made.',
  proofAlt: 'Canvas Tote in the cart with a Checkout control',
  notVerified: 'Not verified',
  categories: [
    { id: 'site', name: CARD_CATALOG.site.name, state: 'problem', answer: '2 pages need attention', context: '12 pages scanned', status: '2 Flags', flagCount: 2, flag: 'availability', flags: ['availability', 'contact'],
      scope: '12 public pages, including the homepage, product pages, and pricing.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: '/pricing', status: 'Flag', flag: 'availability', detail: 'The pricing page returned HTTP 404.', capture: { src: '/marketing/evidence/pricing-unavailable.png', alt: 'Pricing page showing a 404 response' } }, { label: '/contact', status: 'Flag', flag: 'contact', detail: 'The contact page took 4.2 seconds to show its main content on mobile.' }, { label: '10 other pages', status: 'Checked', detail: 'The other public pages opened successfully.' } ] },
    { id: 'conversion', name: CARD_CATALOG.conversion.name, state: 'problem', answer: CART_EXAMPLE.title, context: 'Add to cart · 0 items in the cart', status: '1 Flag', flagCount: 1, flag: 'checkout',
      scope: 'Product → Add to cart → cart → checkout entry. No payment or real order.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Add to cart', status: 'Flag', detail: CART_EXAMPLE.observed }, { label: 'Signup', status: 'Not verified', detail: 'Account checks are shown separately when the website supports signup.' } ],
      connection: { label: 'Shopify context', body: 'Shopify context is coming soon and is not part of this released website check.', href: '/shopify' } },
    { id: 'security', name: CARD_CATALOG.security.name, state: 'healthy', answer: 'Pages use HTTPS', context: 'Public protections', status: '0 Flags', flagCount: 0,
      scope: 'Illustrative public security basics only. No server-side or penetration-test claim.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'HTTPS', status: 'Checked', detail: 'This illustrative result shows HTTPS on the public pages. It is not a security assessment of a real customer website.' }, { label: 'Server-side security', status: 'Outside coverage', detail: 'Not established by public browser inspection.' } ] },
    { id: 'search', name: CARD_CATALOG.search.name, state: 'healthy', answer: 'Search engines can access checked pages', context: 'Homepage and product page', status: '0 Flags', flagCount: 0,
      scope: 'Illustrative title and crawl-access results for the homepage and product page. No ranking claim.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Page titles', status: 'Checked', detail: 'Both sample pages have descriptive titles.' }, { label: 'Crawl access', status: 'Checked', detail: 'The illustrative pages allow search-engine access.' }, { label: 'Search rankings', status: 'Outside coverage', detail: 'Crawlability does not establish visibility or rankings.' } ],
      connection: { label: 'Search Console context', body: 'Search Console context is coming soon. Public Search inspection works independently.', href: '/docs/integrations/google-search-console' } },
    { id: 'performance', name: CARD_CATALOG.performance.name, state: 'healthy', answer: 'Main content loads in 1.8s', context: 'Mobile and desktop', status: '0 Flags', flagCount: 0,
      scope: 'Illustrative loading results for the homepage and product page on mobile and desktop.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Mobile', status: 'Checked', detail: 'Main content loaded in 1.8 seconds.' }, { label: 'Desktop', status: 'Checked', detail: 'Main content loaded in 1.1 seconds.' } ] },
    { id: 'tracking', name: CARD_CATALOG.tracking.name, state: 'healthy', answer: 'Product view event observed', context: 'Public browser event', status: '0 Flags', flagCount: 0,
      scope: 'Illustrative observation of a product-view event in the browser. Delivery to an analytics account is not established.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Product view', status: 'Checked', detail: 'The illustrative product page emitted a public view event.' }, { label: 'Analytics delivery', status: 'Outside coverage', detail: 'A browser event does not prove it reached an analytics account.' } ],
      connection: { label: 'Analytics context', body: 'Analytics context is coming soon. Session counts will not verify a visitor action.', href: '/docs/integrations/google-analytics' } },
    { id: 'accessibility', name: CARD_CATALOG.accessibility.name, state: 'healthy', answer: 'Controls have accessible names', context: 'Automated checks · 2 pages', status: '0 Flags', flagCount: 0,
      scope: 'Illustrative automated results on the homepage and product page. Human accessibility review remains outside this sample.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Controls have names', status: 'Checked', detail: 'The sample reports names for the public controls it inspected.' }, { label: 'Human review', status: 'Outside coverage', detail: 'Automated checks cannot establish complete accessibility.' } ] },
    { id: 'uptime', name: CARD_CATALOG.uptime.name, state: 'healthy', answer: 'Website is reachable', context: 'Scheduled reachability checks', status: '0 Flags', flagCount: 0,
      scope: 'Illustrative reachability across the five sample checks.', checkedAt: '2026-09-14T09:00:00Z',
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
