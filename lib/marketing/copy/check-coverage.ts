import { CARD_CATALOG, type SiteCardArea } from '@/lib/sites/card-areas'

type CoverageArea = {
  id: SiteCardArea
  name: string
  benefit: string
  groups: readonly { title: string; checks: readonly string[] }[]
}

/** Customer-facing coverage, grouped from the public check modules and journey probes. */
const AREAS = [
  { id: 'site', name: CARD_CATALOG.site.name, benefit: 'Find the pages your customers can’t open.', groups: [
    { title: 'Pages and navigation', checks: ['Public page discovery', 'Internal links', 'Page availability and response errors', 'Pricing and contact-page navigation', 'Broken page-section links'] },
    { title: 'Destinations', checks: ['Main action destinations', 'Blank pages and dead ends', 'Stuck loading', 'Destination headlines and next actions', 'Consistency between the original promise and destination'] },
  ] },
  { id: 'conversion', name: CARD_CATALOG.conversion.name, benefit: 'Flag what prevents you from making money.', groups: [
    { title: 'Customer journeys', checks: ['Primary call to action and destination', 'Product, cart, and checkout entry', 'Checkout and sign-in links', 'Journey failures, loops, timeouts, and dead ends', 'Form validation', 'Submission errors and feedback'] },
    { title: 'Customer experience', checks: ['Mobile menus and pricing navigation', 'Overlays blocking buttons, forms, or navigation', 'Loading states and feedback speed', 'Mobile input zoom', 'Mobile button placement', 'Reduced-motion support'] },
    { title: 'Content and layout', checks: ['Call-to-action visibility and focus', 'Headline clarity and value proposition', 'Audience, jargon, and sentence length', 'Placeholder copy and template defaults', 'Form length and trial requirements', 'Contact details and privacy links', 'Testimonials and unsupported claims', 'Visual hierarchy and section structure', 'Information density', 'Typography and corner-radius consistency'] },
    { title: 'Configured signup monitoring', checks: ['Signup through confirmation', 'Safe test data and test account', 'Reset and cleanup path', 'Authorized setup and successful dry run'] },
  ] },
  { id: 'security', name: CARD_CATALOG.security.name, benefit: 'Check your public website’s protections.', groups: [
    { title: 'Connection and content', checks: ['HTTPS', 'Mixed content', 'Privacy policy', 'Contact information', 'Cookie-consent signals'] },
    { title: 'Browser protections', checks: ['Content Security Policy and script permissions', 'Strict-Transport-Security', 'Frame protection', 'Content-type sniffing protection', 'Referrer policy', 'Cross-origin opener, embedder, and resource policies', 'Browser permissions', 'Cross-domain policy headers'] },
  ] },
  { id: 'performance', name: CARD_CATALOG.performance.name, benefit: 'See what keeps your customers waiting.', groups: [
    { title: 'Loading and responsiveness', checks: ['Mobile and desktop loading', 'Largest Contentful Paint', 'Cumulative Layout Shift', 'Interaction to Next Paint', 'Render-blocking resources', 'Unused JavaScript and CSS', 'Image optimization'] },
    { title: 'Mobile experience', checks: ['Content and call-to-action visibility on slow connections', 'Blank screens and delayed content', 'Destination loading time'] },
  ] },
  { id: 'search', name: CARD_CATALOG.search.name, benefit: 'Check that search engines can reach you.', groups: [
    { title: 'Search access', checks: ['Page titles and meta descriptions', 'Heading structure', 'Canonical URLs', 'Indexing directives', 'robots.txt', 'XML sitemaps', 'Structured data', 'Internal links and page-section anchors'] },
    { title: 'Link previews', checks: ['Open Graph titles and descriptions', 'Preview images and image availability', 'Preview consistency across related pages', 'Favicon'] },
    { title: 'With Search Console connected', checks: ['Indexing failures', 'Soft 404s and blocked pages', 'Noindex and canonical mismatches', 'Search click-through rates'] },
  ] },
  { id: 'tracking', name: CARD_CATALOG.tracking.name, benefit: 'Find gaps in your website’s tracking.', groups: [
    { title: 'Analytics setup', checks: ['Analytics tags across public pages', 'Google Analytics, Google Tag Manager, and PostHog markup', 'Missing analytics setup', 'Detected analytics tools'] },
    { title: 'With Analytics connected', checks: ['Audience context', 'Page views and watched-page traffic'] },
  ] },
  { id: 'accessibility', name: CARD_CATALOG.accessibility.name, benefit: 'Catch barriers to using your website.', groups: [
    { title: 'Controls and keyboard access', checks: ['Accessible names for buttons, links, and controls', 'Form labels and embedded-frame titles', 'Keyboard traps', 'Visible focus indicators', 'Tab order', 'Skip links', 'Mobile tap-target sizes'] },
    { title: 'Content and structure', checks: ['Image alternative text', 'Color contrast', 'Page language', 'Headings and list structure', 'ARIA parent and child relationships', 'Duplicate control and ARIA identifiers', 'Page landmarks and main-content region', 'Mobile viewport configuration'] },
  ] },
  { id: 'uptime', name: CARD_CATALOG.uptime.name, benefit: 'Know when your website can’t be reached.', groups: [
    { title: 'Availability', checks: ['Watched-page response', 'Unavailable pages and response errors', 'Checked URL, time, and failure evidence'] },
    { title: 'Incidents and repeat checks', checks: ['Browser console errors', 'Scheduled availability checks', 'Incidents in the last 24 hours', 'Check history', 'Recovery confirmation'] },
  ] },
] as const satisfies readonly CoverageArea[]

export const HOMEPAGE_CHECK_COVERAGE = {
  label: 'What we check',
  title: `Your website, checked across ${AREAS.length} areas.`,
  body: 'From uptime to checkout, including the experience your customers have.',
  explore: (name: string) => `Explore ${name} checks`,
  detailTitle: (name: string) => `${name} checks`,
  detailAction: 'Analyze your website',
  areas: AREAS,
  previews: {
    pages: [{ page: '/pricing', status: '404', flagged: true }, { page: '/products', status: '200', flagged: false }, { page: '/contact', status: '200', flagged: false }],
    conversion: { product: 'Canvas Tote', image: '/marketing/evidence/everyday-tote-product-v2.webp', imageAlt: 'Canvas Tote product photo', action: 'Add to cart', result: 'Item wasn’t added' },
    security: { url: 'https://yourwebsite.com', label: 'HTTPS', status: 'Encrypted connection' },
    performance: [{ device: 'Mobile', value: '1.8s' }, { device: 'Desktop', value: '1.1s' }],
    search: { url: 'everydaygoods.example', title: 'Canvas Tote | Everyday Goods', body: 'Natural canvas tote. $48.', image: '/marketing/evidence/everyday-tote-lifestyle-v2.webp', imageAlt: 'Canvas tote on a sunlit shelf' },
    tracking: { label: 'Analytics coverage', pages: [
      { page: 'Homepage', status: 'Detected', flagged: false },
      { page: '/pricing', status: 'Detected', flagged: false },
      { page: '/contact', status: 'Not detected', flagged: true },
    ] },
    accessibility: { description: 'Increasing text contrast makes the text easier to read.', sample: 'Aa', before: 'Hard to read', after: 'Easy to read' },
    uptime: { description: 'Repeated checks show the website online, then offline, then back online.', periods: [
      { label: 'Online', state: 'online', checks: 12 },
      { label: 'Offline', state: 'offline', checks: 5 },
      { label: 'Back online', state: 'online', checks: 15 },
    ] },
  },
} as const
