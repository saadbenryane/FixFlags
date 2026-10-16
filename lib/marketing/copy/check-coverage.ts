import { CARD_CATALOG, type SiteCardArea } from '@/lib/sites/card-areas'
import { integrationRelease } from '@/lib/integrations/release-policy'

function item<const I extends string>(id: I, label: string) { return { id, label } }

type CoverageArea = {
  id: SiteCardArea
  name: string
  benefit: string
  groups: readonly { title: string; items: readonly { id: string; label: string }[] }[]
}

/** Customer-facing coverage, grouped from the public check modules and journey probes. */
const AREAS = [
  { id: 'uptime', name: CARD_CATALOG.uptime.name, benefit: 'Know when your website can’t be reached.', groups: [
    { title: 'Availability', items: [item('uptime.response', 'Watched-page response'), item('uptime.errors', 'Unavailable pages and response errors'), item('uptime.provenance', 'Checked URL, time, and failure evidence')] },
    { title: 'Incidents and repeat checks', items: [item('uptime.console', 'Browser console errors'), item('uptime.schedule', 'Scheduled availability checks'), item('uptime.incidents', 'Incidents in the last 24 hours'), item('uptime.history', 'Check history'), item('uptime.recovery', 'Recovery confirmation')] },
  ] },
  { id: 'site', name: CARD_CATALOG.site.name, benefit: 'Find the pages your customers can’t open.', groups: [
    { title: 'Pages and navigation', items: [item('pages.discovery', 'Public page discovery'), item('pages.internal-links', 'Internal links'), item('pages.responses', 'Page availability and response errors'), item('pages.pricing-contact', 'Pricing and contact-page navigation'), item('pages.section-links', 'Broken page-section links')] },
    { title: 'Destinations', items: [item('pages.action-destinations', 'Main action destinations'), item('pages.blank-dead-end', 'Blank pages and dead ends'), item('pages.loading', 'Stuck loading'), item('pages.destination-content', 'Destination headlines and next actions'), item('pages.promise-consistency', 'Consistency between the original promise and destination')] },
  ] },
  { id: 'conversion', name: CARD_CATALOG.conversion.name, benefit: 'Find obstacles in your visitors’ next steps.', groups: [
    { title: 'Customer journeys', items: [item('conversion.primary-action', 'Primary call to action and destination'), item('conversion.checkout-entry', 'Product, cart, and checkout entry'), item('conversion.action-links', 'Checkout and sign-in links'), item('conversion.journey-failures', 'Journey failures, loops, timeouts, and dead ends'), item('conversion.validation', 'Form validation'), item('conversion.feedback', 'Submission errors and feedback')] },
    { title: 'Customer experience', items: [item('conversion.mobile-navigation', 'Mobile menus and pricing navigation'), item('conversion.overlays', 'Overlays blocking buttons, forms, or navigation'), item('conversion.loading-feedback', 'Loading states and feedback speed'), item('conversion.input-zoom', 'Mobile input zoom'), item('conversion.button-placement', 'Mobile button placement'), item('conversion.reduced-motion', 'Reduced-motion support')] },
    { title: 'Content and layout', items: [item('conversion.cta-focus', 'Call-to-action visibility and focus'), item('conversion.value-proposition', 'Headline clarity and value proposition'), item('conversion.audience-language', 'Audience, jargon, and sentence length'), item('conversion.placeholder-copy', 'Placeholder copy and template defaults'), item('conversion.form-friction', 'Form length and trial requirements'), item('conversion.contact-privacy', 'Contact details and privacy links'), item('conversion.claims', 'Testimonials and unsupported claims'), item('conversion.hierarchy', 'Visual hierarchy and section structure'), item('conversion.density', 'Information density'), item('conversion.visual-consistency', 'Typography and corner-radius consistency')] },
    { title: 'Automatic account checks on supported websites', items: [item('accounts.signup', 'Supported signup forms'), item('accounts.verification', 'Email verification'), item('accounts.signed-in', 'Signed-in pages'), item('accounts.deletion', 'Test-account deletion')] },
    { title: 'Configured signup monitoring with authorized test data', items: [item('signup.confirmation', 'Signup through confirmation'), item('signup.fixture', 'Safe test data and test account'), item('signup.cleanup', 'Reset and cleanup path'), item('signup.authorization', 'Authorized setup and successful dry run')] },
  ] },
  { id: 'security', name: CARD_CATALOG.security.name, benefit: 'Check your public website’s protections.', groups: [
    { title: 'Connection and content', items: [item('security.https', 'HTTPS'), item('security.mixed-content', 'Mixed content'), item('security.privacy', 'Privacy policy'), item('security.contact', 'Contact information'), item('security.consent', 'Cookie-consent signals')] },
    { title: 'Browser protections', items: [item('security.csp', 'Content Security Policy and script permissions'), item('security.hsts', 'Strict-Transport-Security'), item('security.framing', 'Frame protection'), item('security.content-type', 'Content-type sniffing protection'), item('security.referrer', 'Referrer policy'), item('security.cross-origin', 'Cross-origin opener, embedder, and resource policies'), item('security.permissions', 'Browser permissions'), item('security.cross-domain', 'Cross-domain policy headers')] },
  ] },
  { id: 'performance', name: CARD_CATALOG.performance.name, benefit: 'See what keeps your customers waiting.', groups: [
    { title: 'Loading and responsiveness', items: [item('performance.loading', 'Mobile and desktop loading'), item('performance.lcp', 'Largest Contentful Paint'), item('performance.cls', 'Cumulative Layout Shift'), item('performance.inp', 'Interaction to Next Paint'), item('performance.render-blocking', 'Render-blocking resources'), item('performance.unused-code', 'Unused JavaScript and CSS'), item('performance.images', 'Image optimization')] },
    { title: 'Mobile experience', items: [item('performance.slow-visibility', 'Content and call-to-action visibility on slow connections'), item('performance.blank-delayed', 'Blank screens and delayed content'), item('performance.destination-loading', 'Destination loading time')] },
  ] },
  { id: 'search', name: CARD_CATALOG.search.name, benefit: 'Check that search engines can reach you.', groups: [
    { title: 'Search access', items: [item('search.presentation', 'Page titles and meta descriptions'), item('search.headings', 'Heading structure'), item('search.canonicals', 'Canonical URLs'), item('search.indexing', 'Indexing directives'), item('search.robots', 'robots.txt'), item('search.sitemaps', 'XML sitemaps'), item('search.structured-data', 'Structured data'), item('search.links', 'Internal links and page-section anchors')] },
    { title: 'Link previews', items: [item('search.open-graph', 'Open Graph titles and descriptions'), item('search.preview-image', 'Preview images and image availability'), item('search.preview-consistency', 'Preview consistency across related pages'), item('search.favicon', 'Favicon')] },
    { title: integrationRelease('search-console') === 'planned' ? 'Coming soon: Search Console context' : 'With Search Console connected', items: [item('search.google-indexing', 'Indexing failures'), item('search.google-soft404', 'Soft 404s and blocked pages'), item('search.google-declarations', 'Noindex and canonical mismatches'), item('search.google-ctr', 'Search click-through rates')] },
  ] },
  { id: 'tracking', name: CARD_CATALOG.tracking.name, benefit: 'Find gaps in your website’s tracking.', groups: [
    { title: 'Analytics setup', items: [item('tracking.page-tags', 'Analytics tags across public pages'), item('tracking.markup', 'Google Analytics, Google Tag Manager, and PostHog markup'), item('tracking.absence', 'Missing analytics setup'), item('tracking.tools', 'Detected analytics tools')] },
    { title: integrationRelease('analytics') === 'planned' ? 'Coming soon: Analytics context' : 'With Analytics connected', items: [item('tracking.audience', 'Audience context'), item('tracking.page-traffic', 'Page views and watched-page traffic')] },
  ] },
  { id: 'accessibility', name: CARD_CATALOG.accessibility.name, benefit: 'Catch barriers to using your website.', groups: [
    { title: 'Controls and keyboard access', items: [item('accessibility.names', 'Accessible names for buttons, links, and controls'), item('accessibility.labels', 'Form labels and embedded-frame titles'), item('accessibility.traps', 'Keyboard traps'), item('accessibility.focus', 'Visible focus indicators'), item('accessibility.tab-order', 'Tab order'), item('accessibility.skip-links', 'Skip links'), item('accessibility.targets', 'Mobile tap-target sizes')] },
    { title: 'Content and structure', items: [item('accessibility.alt', 'Image alternative text'), item('accessibility.contrast', 'Color contrast'), item('accessibility.language', 'Page language'), item('accessibility.structure', 'Headings and list structure'), item('accessibility.aria', 'ARIA parent and child relationships'), item('accessibility.identifiers', 'Duplicate control and ARIA identifiers'), item('accessibility.landmarks', 'Page landmarks and main-content region'), item('accessibility.viewport', 'Mobile viewport configuration')] },
  ] },
] as const satisfies readonly CoverageArea[]

export const HOMEPAGE_CHECK_COVERAGE = {
  label: 'What we check',
  title: `Your website, checked across ${AREAS.length} areas.`,
  body: 'From uptime to checkout, including the experience your customers have.',
  explore: (name: string) => `Explore ${name} checks`,
  detailTitle: (name: string) => `${name} checks`,
  detailAction: 'Analyze your website',
  areas: AREAS.map(area => ({ ...area, groups: area.groups.map(group => ({ ...group, checks: group.items.map(check => check.label) })) })),
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
