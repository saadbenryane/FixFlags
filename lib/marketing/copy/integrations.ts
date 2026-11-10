import { integrationRelease } from '@/lib/integrations/release-policy'

export const INTEGRATIONS_PAGE = {
  hero: {
    label: 'Integrations',
    title: 'Just your website to get started.',
    body: 'Check public pages and copy fix instructions without connecting anything. GitHub account connection is available now.',
  },
  checkWebsite: 'Check your website',
  currentListTitle: 'What it adds',
  plannedTitle: 'Planned connections',
  availableLabel: 'Available',
  items: [
    {
      id: 'github', status: integrationRelease('github'), title: 'GitHub', logo: '/brand/integrations/github.svg',
      purpose: 'GitHub account connection',
      summary: 'Link your GitHub account if you want to. You can check your website and copy fix instructions without it.',
      checks: ['Connect your GitHub account', 'Connection details are stored securely', 'Disconnect in account settings'],
      action: 'Manage GitHub connection', href: '/settings/integrations',
    },
    {
      id: 'shopify', status: integrationRelease('shopify'), title: 'Shopify', logo: '/brand/integrations/shopify.svg',
      purpose: 'Storefront and checkout',
      summary: 'Product information and checks from a product page to checkout.',
      checks: ['Product information from your store', 'Adding selected products to the cart and opening checkout', 'Problems found along the way'],
      action: 'Read integration guide', href: '/docs/integrations/shopify',
    },
    {
      id: 'analytics', status: integrationRelease('analytics'), title: 'Google Analytics', logo: '/brand/integrations/google-analytics.svg',
      purpose: 'Page traffic',
      summary: 'Page traffic alongside the pages FixFlags watches.',
      checks: ['Sessions on watched pages over the last 28 days', 'Traffic context beside page-specific Flags', 'A matched Analytics property for your Site'],
      action: 'Read integration guide', href: '/docs/integrations/google-analytics',
    },
    {
      id: 'search-console', status: integrationRelease('search-console'), title: 'Google Search Console', logo: '/brand/integrations/google-search-console.svg',
      purpose: 'Search traffic',
      summary: 'See how people find your pages in Google search.',
      checks: ['Queries and impressions for matching Site pages', 'Search clicks beside page-specific Flags', 'A matched Search Console property for your Site'],
      action: 'Read integration guide', href: '/docs/integrations/google-search-console',
    },
    {
      id: 'woocommerce', status: integrationRelease('woocommerce'), title: 'WooCommerce', logo: '/brand/integrations/woocommerce.svg',
      purpose: 'Products and orders',
      summary: 'Product and checkout information for WordPress shops.',
      checks: ['Product availability versus the public product page', 'Cart and checkout failures after plugin updates', 'Store API errors on purchase paths'],
    },
    {
      id: 'posthog', status: integrationRelease('posthog'), title: 'PostHog', logo: '/brand/integrations/posthog.svg',
      purpose: 'Visitor activity',
      summary: 'See the steps visitors take and where they stop.',
      checks: ['Missing events on watched journeys', 'Funnel steps with sudden drop-off', 'Event changes after a published fix'],
    },
    {
      id: 'stripe', status: integrationRelease('stripe'), title: 'Stripe', logo: '/brand/integrations/stripe.svg',
      purpose: 'Payments',
      summary: 'Payment and Checkout events beside the browser journey.',
      checks: ['Payment failures versus checkout-entry failures', 'Checkout sessions that expire before completion', 'Payment-event changes after a release'],
    },
    {
      id: 'sentry', status: integrationRelease('sentry'), title: 'Sentry', logo: '/brand/integrations/sentry.svg',
      purpose: 'Application errors',
      summary: 'Website errors and recent updates beside the affected page.',
      checks: ['New errors on pages with active Flags', 'Error spikes after a release', 'Repeated exceptions during a watched journey'],
    },
    {
      id: 'vercel', status: integrationRelease('vercel'), title: 'Vercel', logo: '/brand/integrations/vercel.svg',
      purpose: 'Updates and speed',
      summary: 'Published updates and website speed in one place.',
      checks: ['First failed check after a production deployment', 'Failed or rolled-back deployments', 'Web Vital regressions after a release'],
    },
    {
      id: 'cloudflare', status: integrationRelease('cloudflare'), title: 'Cloudflare', logo: '/brand/integrations/cloudflare.svg',
      purpose: 'Traffic and protection',
      summary: 'Connection errors and security screens that get in visitors’ way.',
      checks: ['5xx spikes on watched paths', 'WAF challenges blocking signup or checkout', 'Origin failures versus edge failures'],
    },
  ],
} as const
