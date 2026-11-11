import { CARD_CATALOG, type SiteCardArea } from '@/lib/sites/card-areas'

function example<const I extends string>(id: I, label: string) { return { id, label } }

/**
 * What we say publicly about each area: the outcome, plus three examples of what we check.
 * The full list stays in the product (`lib/audit/coverage-catalog`); each example must match it.
 */
const AREAS = [
  { id: 'uptime', name: CARD_CATALOG.uptime.name, benefit: 'Know when your website can’t be reached.', examples: [example('uptime.response', 'Whether the page responds'), example('uptime.schedule', 'Scheduled availability checks'), example('uptime.recovery', 'Checking that the website is back online')] },
  { id: 'site', name: CARD_CATALOG.site.name, benefit: 'Find the pages your visitors can’t reach.', examples: [example('pages.internal-links', 'Internal links'), example('pages.action-destinations', 'Where the main buttons lead'), example('pages.blank-dead-end', 'Blank pages and dead ends')] },
  { id: 'conversion', name: CARD_CATALOG.conversion.name, benefit: 'Spot the steps that stop visitors moving forward.', examples: [example('conversion.checkout-entry', 'Product, cart, and checkout entry'), example('conversion.journey-failures', 'Steps that fail, loop, get stuck, or lead nowhere'), example('conversion.overlays', 'Overlays blocking buttons, forms, or navigation')] },
  { id: 'security', name: CARD_CATALOG.security.name, benefit: 'Check your connection and browser protections.', examples: [example('security.https', 'HTTPS'), example('security.mixed-content', 'Mixed content'), example('security.privacy', 'Privacy policy')] },
  { id: 'performance', name: CARD_CATALOG.performance.name, benefit: 'See what’s slowing your visitors down.', examples: [example('performance.loading', 'Mobile and desktop loading'), example('performance.lcp', 'How soon the main content appears (LCP)'), example('performance.images', 'Image optimization')] },
  { id: 'search', name: CARD_CATALOG.search.name, benefit: 'Check that search engines can reach you.', examples: [example('search.presentation', 'Page titles and meta descriptions'), example('search.indexing', 'Instructions that allow or block search listings'), example('search.open-graph', 'Titles and descriptions for shared links')] },
  { id: 'tracking', name: CARD_CATALOG.tracking.name, benefit: 'Find gaps in your website’s tracking.', examples: [example('tracking.page-tags', 'Analytics tags across public pages'), example('tracking.absence', 'Missing analytics setup'), example('tracking.tools', 'Detected analytics tools')] },
  { id: 'accessibility', name: CARD_CATALOG.accessibility.name, benefit: 'Find barriers to reading, navigating, and taking action.', examples: [example('accessibility.contrast', 'Color contrast'), example('accessibility.labels', 'Form labels and embedded-frame titles'), example('accessibility.targets', 'Mobile tap-target sizes')] },
] as const satisfies readonly { id: SiteCardArea; name: string; benefit: string; examples: readonly { id: string; label: string }[] }[]

export const HOMEPAGE_CHECK_COVERAGE = {
  label: 'What we check',
  title: `Every page and button, checked across ${AREAS.length} areas.`,
  titleLines: ['Every page. Every button.', 'Checked like a visitor.'] as const,
  body: `A page can load while its checkout is broken. So we check ${AREAS.length} areas, the way your visitors use your site.`,
  explore: (name: string) => `Explore ${name} checks`,
  detailTitle: (name: string) => `${name} checks`,
  detailAction: 'Check your website',
  examplesLabel: 'Examples of what we check',
  areas: AREAS,
  previews: {
    pages: [{ page: '/pricing', status: '404', flagged: true }, { page: '/products', status: '200', flagged: false }, { page: '/contact', status: '200', flagged: false }],
    conversion: { product: 'Canvas Tote', image: '/marketing/evidence/everyday-tote-product-v2.webp', imageAlt: 'Canvas Tote product photo', action: 'Add to cart', result: 'Item wasn’t added' },
    security: { url: 'https://yourwebsite.com', label: 'HTTPS', status: 'Encrypted connection' },
    performance: [{ device: 'Mobile', value: '1.8s' }, { device: 'Desktop', value: '1.1s' }],
    search: { url: 'everydaygoods.example', title: 'Canvas Tote | Everyday Goods', body: 'Natural canvas tote. $48.' },
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
