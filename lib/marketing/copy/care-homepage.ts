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
    body: WEBSITE_PROMISE,
    setup: PRODUCT_STORY.setup,
    cta: PRODUCT_STORY.action,
    sampleAction: 'See it in action',
    placeholder: 'yourwebsite.com',
    benefits: [
      { title: 'Checks on your schedule' },
      { title: 'Email alerts' },
      { title: 'Clear fix guidance' },
    ],
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
  performanceFlags: [{ id: 'perf-1', title: 'Campaign page is slow', href: '#product' }],
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
    unconfiguredBody: 'Automatic account checks use a FixFlags test identity when the service and website support them. Unsupported signup flows remain unverified.',
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
  story: {
    label: 'Website checks',
    title: 'Online isn’t the same as working.',
    body: 'A page can load while checkout fails. FixFlags follows the journey, then checks the fix.',
    before: 'The Flag', after: 'Verified recovery',
    beforeTitle: 'Checkout fails.',
    beforeBody: 'The product page loads. Checkout returns an error.',
    afterTitle: 'Checkout opens again.',
    afterBody: 'After the fix, a fresh check reaches checkout.',
    guidanceTitle: 'From Flag to fix.',
    guidance: 'Copy a prompt with the page, the problem, and what should happen instead. Use it with your AI or developer, then check the live website after publishing.',
    copy: 'Copy fix prompt', copied: 'Prompt copied.',
    sample: 'Illustrative checkout example',
    comparisonNote: 'Illustrative checkout example. Product to checkout, with no payment or order.',
    recoveryNote: 'Publish the change. Then check it again.',
    about: 'What this example shows',
    aboutBody: 'This illustration follows a failure and recovery reproduced on a controlled local website: the public page opened, checkout returned HTTP 503, and a fresh independent check reached checkout after repair. It represents checkout entry only. No payment or order was made. Switching this example does not run a check.',
    example: {
      store: 'Everyday Goods', basket: '1 item', product: 'Canvas Tote', productDetail: 'Natural · Quantity 1', price: '$48',
      failedLabel: 'Illustrative checkout failure', recoveredLabel: 'Illustrative checkout recovery',
      failedTitle: 'Checkout is unavailable', failedBody: 'Your item is in the bag, but you can’t continue to checkout.',
      recoveredTitle: 'You’ve reached checkout', recoveredBody: 'The checkout page opened with the selected product.',
      error: 'Checkout returned an error', contact: 'Contact information', delivery: 'Delivery address',
      checked: 'What FixFlags checked', page: 'Product page opened', checkoutFailed: 'Checkout failed', checkoutPassed: 'Checkout opened',
      scope: 'Product to checkout. No payment or order.',
    },
  },
  workflow: {
    label: 'Monitor. Flag. Fix.',
    action: 'See how it works',
    title: 'See the problem. Know when it’s fixed.',
    body: 'Give the evidence to your teammate or AI. After the fix, let FixFlags check again.',
    steps: [
      { id: 'monitor', label: '01 · Monitor', title: 'Start with your URL.', body: 'Run a free check on your public website. Save your Site to start scheduled monitoring.' },
      { id: 'flag', label: '02 · Flag', title: 'See what needs attention.', body: 'A Flag shows the page, the problem, and the evidence. New problems can trigger an email.' },
      { id: 'fix', label: '03 · Fix', title: 'Fix it. Then check again.', body: 'Give your AI or developer the fix prompt. Publish the change, then select Check now to see whether it worked.' },
    ],
    failedAlt: 'Canvas Tote product page after Add to cart with an empty cart',
    passedAlt: 'Canvas Tote product page with one item in the cart and a Checkout control',
    passedLink: 'Open the recovery example',
    failedLabel: '1 Flag',
    failedTitle: 'Cart stayed empty',
    viewFlag: 'View flag',
    compareLabel: 'Compare the empty cart with the recovery example',
    passedLabel: 'Sample recovery',
    passedTitle: 'The product is in the cart',
    proofLabel: 'Sample cart problem',
    page: '/products/canvas-tote',
    source: 'Local browser fixtures · Product and cart',
    instructions: CART_EXAMPLE.prompt,
  },
  notifications: {
    label: 'Email alerts',
    title: 'The problem, in your inbox.',
    body: 'FixFlags checks on your schedule. Get email alerts about new problems and confirmed fixes, with a link to the evidence.',
    detailTitle: 'What gets checked?',
    detailBody: 'Save your Site to activate monitoring. Your Site shows the supported checks, schedule, and latest results. Email alerts follow your notification settings. Problems can be detected at the next scheduled check.',
    sampleLabel: 'Example email · illustrative evidence',
    sender: 'FixFlags',
    host: 'www.examplesites.com',
    flag: 'Pricing page is not loading',
    action: 'Explore the sample Flag',
  },
  coverage: {
    label: 'What FixFlags watches',
    title: 'Watch what people came to do.',
    body: 'FixFlags discovers supported checks and keeps running them on the live site.',
    analysisLabel: 'Also analyzed',
    analysis: ['Performance', 'Accessibility', 'Search', 'Security', 'Tracking', 'Layout'],
    boundary: 'Automatic account checks use a reusable FixFlags identity and a separate disposable account for signup and deletion. Unsupported authentication flows remain unverified.',
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
    label: 'Fix guidance',
    title: 'Ready for the person fixing it.',
    body: 'See what happened, where it happened, and what should happen instead.',
    promptLabel: 'Example fix prompt',
    promptTitle: 'Pricing page won’t open.',
    promptFacts: [
      { label: 'Page', value: '/pricing' },
      { label: 'Observed', value: 'The pricing page returns HTTP 404.' },
      { label: 'Expected', value: 'The pricing page opens with its content.' },
    ],
    editorLabel: 'Works with the AI you use',
    editorGuidesLabel: 'AI editor setup guides',
    guidanceAction: 'How to fix with AI',
    packet: [
      { label: 'Journey', value: 'Complete a purchase' },
      { label: 'Observed', value: 'Add to cart left the cart empty' },
      { label: 'Expected', value: 'The product appears and checkout opens' },
    ],
    choices: [
      { id: 'read', title: 'Open the details', body: 'Inspect the evidence, affected page, and reproduction steps.', action: 'Open details' },
      { id: 'share', title: 'Share the Flag', body: 'Pass the same evidence and expected result to a teammate.', action: 'Copy Flag' },
      { id: 'ai', title: 'Send it to your AI', body: 'Copy an evidence-backed prompt with clear verification criteria.', action: 'Copy AI prompt' },
    ],
    copied: 'Flag copied', copyFailed: 'Copy was unavailable. Open the Flag to use the details.',
    hide: 'Hide details', verify: 'Verified only after a fresh browser journey completes the same purchase path.',
  },
  integrations: {
    label: 'Integrations',
    title: 'Your tools, when you need them.',
    body: 'Website checks need no integration. GitHub account connection is available. More connections are coming soon.',
    detailsAction: 'See the connections',
    center: 'Independent checks',
    add: 'Add integration',
    addTitle: 'Add an integration',
    addBody: 'These planned connections will add context beside a Flag. They will not establish verified recovery.',
    sampleNote: 'Illustrative integration evidence. GitHub is available; other connections are coming soon.',
    addAction: 'Add',
    added: 'Added',
    action: 'Explore integrations',
  },
  close: { title: 'Try it on your website.', body: 'Run a free check. Save your Site for fix prompts and scheduled monitoring.', pricing: 'What’s included for free' },
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
  exploreAction: 'Explore the sample', sampleLabel: 'Interactive sample · illustrative evidence',
  identityAlt: 'Everyday Goods sample homepage, shown for website identity',
  title: 'See what needs attention.',
  subtitle: 'A Flag is a problem that needs attention. Open one to see the evidence and fix guidance.',
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
  analyzeAction: 'Analyze your website',
  resultsTitle: 'Results in this area',
  evidenceAction: 'Scope and evidence',
  detailAction: 'View Flag',
  fixTitle: 'Fix prompt',
  fixBody: 'Give your AI the prompt to fix it.',
  guidanceAction: 'How to fix with AI',
  observedLabel: 'Observed',
  expectedLabel: 'Expected',
  scopeLabel: 'Scope',
  proofTitle: 'Recovery example',
  proofBody: 'A new check reached checkout after the fix. No payment or order was made.',
  availabilityTitle: 'Pricing page is not loading',
  availabilityObserved: 'The pricing page returned 404.',
  availabilityExpected: 'The pricing page opens.',
  availabilityFix: 'Restore the /pricing route and its content, then verify that the same URL responds successfully.',
  checkoutFix: 'Restore checkout, publish the change, then ask FixFlags to check it again.',
  availabilityPrompt: 'FixFlags sample Flag: /pricing returns HTTP 404. Restore the route and pricing content. After publishing, request a fresh independent check of /pricing and confirm a successful response. Copying this prompt does not resolve a Flag.',
  availabilityAlt: 'Pricing page showing a 404 response',
  unresolved: 'Run a fresh check after publishing the fix.',
  guidanceCopied: 'Fix prompt copied.',
  copyFailed: 'Clipboard unavailable. Select and copy the prompt below.',
  sampleCopy: 'Copy fix prompt',
  connections: 'Connections add context; they do not establish recovery.',
  recoveryAction: 'View sample recovery',
  sources: { http: 'https://everydaygoods.example/pricing', browser: 'https://everydaygoods.example/products/canvas-tote', diagnostics: 'Illustrative diagnostic results' },
  guidanceLabel: 'Fix prompt',
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
      connection: { label: 'Search Console context', body: 'Search Console context is coming soon. Public Search inspection works independently.', href: '/integrations#search-console' } },
    { id: 'performance', name: CARD_CATALOG.performance.name, state: 'healthy', answer: 'Main content loads in 1.8s', context: 'Mobile and desktop', status: '0 Flags', flagCount: 0,
      scope: 'Illustrative loading results for the homepage and product page on mobile and desktop.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Mobile', status: 'Checked', detail: 'Main content loaded in 1.8 seconds.' }, { label: 'Desktop', status: 'Checked', detail: 'Main content loaded in 1.1 seconds.' } ] },
    { id: 'tracking', name: CARD_CATALOG.tracking.name, state: 'healthy', answer: 'Product view event observed', context: 'Public browser event', status: '0 Flags', flagCount: 0,
      scope: 'Illustrative observation of a product-view event in the browser. Delivery to an analytics account is not established.', checkedAt: '2026-09-14T09:00:00Z',
      results: [ { label: 'Product view', status: 'Checked', detail: 'The illustrative product page emitted a public view event.' }, { label: 'Analytics delivery', status: 'Outside coverage', detail: 'A browser event does not prove it reached an analytics account.' } ],
      connection: { label: 'Analytics context', body: 'Analytics context is coming soon. Session counts will not verify a visitor action.', href: '/integrations#analytics' } },
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
