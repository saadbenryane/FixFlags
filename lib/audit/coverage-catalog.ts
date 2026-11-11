import type { SiteCardArea } from '@/lib/sites/card-areas'
import { integrationRelease } from '@/lib/integrations/release-policy'

function item<const I extends string>(id: I, label: string) { return { id, label } }

type CoverageArea = {
  id: SiteCardArea
  groups: readonly { title: string; items: readonly { id: string; label: string }[] }[]
}

/**
 * Every check FixFlags runs, grouped by area. Internal: it binds each advertised check to its
 * evaluators in `advertised-coverage`. Public pages show a few examples per area from
 * `lib/marketing/copy/check-coverage`, never this full list.
 */
export const COVERAGE_CATALOG = [
  { id: 'uptime', groups: [
    { title: 'Availability', items: [item('uptime.response', 'Whether the page responds'), item('uptime.errors', 'Pages that won’t open or return an error'), item('uptime.provenance', 'The page, check time, and what went wrong')] },
    { title: 'Incidents and repeat checks', items: [item('uptime.console', 'Browser console errors'), item('uptime.schedule', 'Scheduled availability checks'), item('uptime.incidents', 'Incidents in the last 24 hours'), item('uptime.history', 'Check history'), item('uptime.recovery', 'Checking that the website is back online')] },
  ] },
  { id: 'site', groups: [
    { title: 'Pages and navigation', items: [item('pages.discovery', 'Finding your public pages'), item('pages.internal-links', 'Internal links'), item('pages.responses', 'Page availability and response errors'), item('pages.pricing-contact', 'Pricing and contact-page navigation'), item('pages.section-links', 'Broken page-section links')] },
    { title: 'Destinations', items: [item('pages.action-destinations', 'Where the main buttons lead'), item('pages.blank-dead-end', 'Blank pages and dead ends'), item('pages.loading', 'Stuck loading'), item('pages.destination-content', 'Headings and buttons on the next page'), item('pages.promise-consistency', 'Whether a button leads where it promises')] },
  ] },
  { id: 'conversion', groups: [
    { title: 'Steps your visitors take', items: [item('conversion.primary-action', 'Your main button and the page it opens'), item('conversion.checkout-entry', 'Product, cart, and checkout entry'), item('conversion.action-links', 'Checkout and sign-in links'), item('conversion.journey-failures', 'Steps that fail, loop, get stuck, or lead nowhere'), item('conversion.validation', 'Form validation'), item('conversion.feedback', 'Submission errors and feedback')] },
    { title: 'Customer experience', items: [item('conversion.mobile-navigation', 'Mobile menus and pricing navigation'), item('conversion.overlays', 'Overlays blocking buttons, forms, or navigation'), item('conversion.loading-feedback', 'Loading states and feedback speed'), item('conversion.input-zoom', 'Mobile input zoom'), item('conversion.button-placement', 'Mobile button placement'), item('conversion.reduced-motion', 'Reduced-motion support')] },
    { title: 'Content and layout', items: [item('conversion.cta-focus', 'Call-to-action visibility and focus'), item('conversion.value-proposition', 'Whether your headline explains what you offer'), item('conversion.audience-language', 'Audience, jargon, and sentence length'), item('conversion.placeholder-copy', 'Placeholder copy and template defaults'), item('conversion.form-friction', 'Form length and trial requirements'), item('conversion.contact-privacy', 'Contact details and privacy links'), item('conversion.claims', 'Testimonials and claim wording'), item('conversion.hierarchy', 'Whether the page is easy to follow'), item('conversion.density', 'Too much information at once'), item('conversion.visual-consistency', 'Consistent text and shapes')] },
    { title: 'Coming soon: automatic account checks', items: [item('accounts.signup', 'Supported signup forms'), item('accounts.verification', 'Email verification'), item('accounts.signed-in', 'Signed-in pages'), item('accounts.deletion', 'Test-account deletion')] },
    { title: 'Configured signup monitoring with authorized test data', items: [item('signup.confirmation', 'Signup through confirmation'), item('signup.fixture', 'Safe test data and test account'), item('signup.cleanup', 'Reset and cleanup path'), item('signup.authorization', 'Authorized setup and successful dry run')] },
  ] },
  { id: 'security', groups: [
    { title: 'Connection and content', items: [item('security.https', 'HTTPS'), item('security.mixed-content', 'Mixed content'), item('security.privacy', 'Privacy policy'), item('security.contact', 'Contact information'), item('security.consent', 'Cookie-consent signals')] },
    { title: 'Browser protections', items: [item('security.csp', 'Content Security Policy and script permissions'), item('security.hsts', 'Strict-Transport-Security'), item('security.framing', 'Frame protection'), item('security.content-type', 'Content-type sniffing protection'), item('security.referrer', 'Referrer policy'), item('security.cross-origin', 'Cross-origin opener, embedder, and resource policies'), item('security.permissions', 'Browser permissions'), item('security.cross-domain', 'Cross-domain policy headers')] },
  ] },
  { id: 'performance', groups: [
    { title: 'Loading and responsiveness', items: [item('performance.loading', 'Mobile and desktop loading'), item('performance.lcp', 'How soon the main content appears (LCP)'), item('performance.cls', 'Whether the layout jumps while loading (CLS)'), item('performance.inp', 'How quickly the page responds to a tap (INP)'), item('performance.render-blocking', 'Files that delay the page appearing'), item('performance.unused-code', 'Unused JavaScript and CSS'), item('performance.images', 'Image optimization')] },
    { title: 'Mobile experience', items: [item('performance.slow-visibility', 'Content and call-to-action visibility on slow connections'), item('performance.blank-delayed', 'Blank screens and delayed content'), item('performance.destination-loading', 'Destination loading time')] },
  ] },
  { id: 'search', groups: [
    { title: 'Search access', items: [item('search.presentation', 'Page titles and meta descriptions'), item('search.headings', 'Heading structure'), item('search.canonicals', 'Which version of a page search engines should use'), item('search.indexing', 'Instructions that allow or block search listings'), item('search.robots', 'Rules for search engines (robots.txt)'), item('search.sitemaps', 'Your list of pages for search engines (sitemap)'), item('search.structured-data', 'Extra page details for search engines'), item('search.links', 'Internal links and page-section anchors')] },
    { title: 'Link previews', items: [item('search.open-graph', 'Titles and descriptions for shared links'), item('search.preview-image', 'Preview images and image availability'), item('search.preview-consistency', 'Preview consistency across related pages'), item('search.favicon', 'Favicon')] },
    { title: integrationRelease('search-console') === 'planned' ? 'Coming soon: Search Console context' : 'With Search Console connected', items: [item('search.google-indexing', 'Indexing failures'), item('search.google-soft404', 'Soft 404s and blocked pages'), item('search.google-declarations', 'Noindex and canonical mismatches'), item('search.google-ctr', 'Search click-through rates')] },
  ] },
  { id: 'tracking', groups: [
    { title: 'Analytics setup', items: [item('tracking.page-tags', 'Analytics tags across public pages'), item('tracking.markup', 'Google Analytics, Google Tag Manager, and PostHog markup'), item('tracking.absence', 'Missing analytics setup'), item('tracking.tools', 'Detected analytics tools')] },
    { title: integrationRelease('analytics') === 'planned' ? 'Coming soon: Analytics context' : 'With Analytics connected', items: [item('tracking.audience', 'Information about your visitors'), item('tracking.page-traffic', 'Page views and watched-page traffic')] },
  ] },
  { id: 'accessibility', groups: [
    { title: 'Controls and keyboard access', items: [item('accessibility.names', 'Accessible names for buttons, links, and controls'), item('accessibility.labels', 'Form labels and embedded-frame titles'), item('accessibility.traps', 'Keyboard traps'), item('accessibility.focus', 'Visible focus indicators'), item('accessibility.tab-order', 'Tab order'), item('accessibility.skip-links', 'Skip links'), item('accessibility.targets', 'Mobile tap-target sizes')] },
    { title: 'Content and structure', items: [item('accessibility.alt', 'Image alternative text'), item('accessibility.contrast', 'Color contrast'), item('accessibility.language', 'Page language'), item('accessibility.structure', 'Headings and list structure'), item('accessibility.aria', 'ARIA parent and child relationships'), item('accessibility.identifiers', 'Duplicate control and ARIA identifiers'), item('accessibility.landmarks', 'Page landmarks and main-content region'), item('accessibility.viewport', 'Mobile viewport configuration')] },
  ] },
] as const satisfies readonly CoverageArea[]
