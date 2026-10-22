import { integrationRelease } from '@/lib/integrations/release-policy'

export const INTEGRATIONS_PAGE = {
  hero: {
    label: 'Integrations',
    title: 'Connections, when you need them.',
    body: 'Start checking with your website URL. GitHub account connection is available. Other connections are coming soon.',
  },
  checkWebsite: 'Check your website',
  currentListTitle: 'What it adds',
  futureListTitle: 'Planned capabilities',
  proposedLabel: 'Coming soon',
  availableLabel: 'Available',
  items: [
    {
      id: 'github', status: integrationRelease('github'), title: 'GitHub', logo: '/brand/integrations/github.svg',
      purpose: 'GitHub account connection',
      summary: 'Connect or disconnect your GitHub account. Website checks and fix prompts work without this connection.',
      checks: ['GitHub account authorization', 'Encrypted token storage', 'Disconnect from account settings'],
      action: 'Manage GitHub connection', href: '/settings/integrations',
    },
    {
      id: 'shopify', status: integrationRelease('shopify'), title: 'Shopify', logo: '/brand/integrations/shopify.svg',
      purpose: 'Storefront and checkout',
      summary: 'Planned: product information and an independent walk from a saleable product to checkout.',
      checks: ['Product information for connected stores', 'Cart and checkout entry on selected saleable products', 'Purchase-path Flags when a watched step fails'],
      action: 'Read integration guide', href: '/docs/integrations/shopify',
    },
    {
      id: 'analytics', status: integrationRelease('analytics'), title: 'Google Analytics', logo: '/brand/integrations/google-analytics.svg',
      purpose: 'Page traffic',
      summary: 'Planned: page traffic alongside the pages FixFlags watches.',
      checks: ['Sessions on watched pages over the last 28 days', 'Traffic context beside page-specific Flags', 'A matched Analytics property for your Site'],
      action: 'Read integration guide', href: '/docs/integrations/google-analytics',
    },
    {
      id: 'search-console', status: integrationRelease('search-console'), title: 'Google Search Console', logo: '/brand/integrations/google-search-console.svg',
      purpose: 'Search demand',
      summary: 'Planned: queries, impressions, and clicks for matching Site pages.',
      checks: ['Queries and impressions for matching Site pages', 'Search clicks beside page-specific Flags', 'A matched Search Console property for your Site'],
      action: 'Read integration guide', href: '/docs/integrations/google-search-console',
    },
    {
      id: 'woocommerce', status: integrationRelease('woocommerce'), title: 'WooCommerce', logo: '/brand/integrations/woocommerce.svg',
      purpose: 'Products and orders',
      summary: 'Planned: store catalog and checkout context for WordPress shops.',
      checks: ['Product availability versus the public product page', 'Cart and checkout failures after plugin updates', 'Store API errors on purchase paths'],
    },
    {
      id: 'posthog', status: integrationRelease('posthog'), title: 'PostHog', logo: '/brand/integrations/posthog.svg',
      purpose: 'Events and funnels',
      summary: 'Planned: journey events and the steps where visitors stop.',
      checks: ['Missing events on watched journeys', 'Funnel steps with sudden drop-off', 'Event changes after a published fix'],
    },
    {
      id: 'stripe', status: integrationRelease('stripe'), title: 'Stripe', logo: '/brand/integrations/stripe.svg',
      purpose: 'Payment outcomes',
      summary: 'Planned: payment and Checkout events beside the browser journey.',
      checks: ['Payment failures versus checkout-entry failures', 'Checkout sessions that expire before completion', 'Payment-event changes after a release'],
    },
    {
      id: 'sentry', status: integrationRelease('sentry'), title: 'Sentry', logo: '/brand/integrations/sentry.svg',
      purpose: 'Application errors',
      summary: 'Planned: browser exceptions and releases around an affected page.',
      checks: ['New errors on pages with active Flags', 'Error spikes after a release', 'Repeated exceptions during a watched journey'],
    },
    {
      id: 'vercel', status: integrationRelease('vercel'), title: 'Vercel', logo: '/brand/integrations/vercel.svg',
      purpose: 'Deployments and speed',
      summary: 'Planned: production releases and performance context.',
      checks: ['First failed check after a production deployment', 'Failed or rolled-back deployments', 'Web Vital regressions after a release'],
    },
    {
      id: 'cloudflare', status: integrationRelease('cloudflare'), title: 'Cloudflare', logo: '/brand/integrations/cloudflare.svg',
      purpose: 'Edge traffic and protection',
      summary: 'Planned: edge errors and security challenges affecting visitors.',
      checks: ['5xx spikes on watched paths', 'WAF challenges blocking signup or checkout', 'Origin failures versus edge failures'],
    },
  ],
} as const
