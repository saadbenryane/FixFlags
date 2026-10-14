/** Customer availability follows the owner's release scope, independently of provider configuration. */
export const INTEGRATION_RELEASES = {
  github: 'available', shopify: 'planned', analytics: 'planned', 'search-console': 'planned',
  woocommerce: 'planned', posthog: 'planned', stripe: 'planned', sentry: 'planned', vercel: 'planned', cloudflare: 'planned',
} as const
export type IntegrationId = keyof typeof INTEGRATION_RELEASES
export type IntegrationRelease = 'available' | 'planned'
export function integrationRelease(id: IntegrationId): IntegrationRelease { return INTEGRATION_RELEASES[id] }
