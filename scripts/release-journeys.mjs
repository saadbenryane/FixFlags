export const REQUIRED_RELEASE_JOURNEYS = [
  'anonymous-claim',
  'free-chat-timeline',
  'passkey-2fa-recovery',
  'billing-webhook-active',
  'billing-revoked',
  'pro-canvas',
  'studio-product-boundary',
  'protected-sharing',
  'attempt-update-receipt',
  'watch-child-notification',
  'github-oauth-pr',
  'mcp-full-loop',
  'cli-registry-loop',
]

export const JOURNEYS_BY_STAGE = {
  'credentialed-core': [
    'anonymous-claim',
    'free-chat-timeline',
    'passkey-2fa-recovery',
    'pro-canvas',
    'studio-product-boundary',
    'protected-sharing',
    'attempt-update-receipt',
    'mcp-full-loop',
  ],
  'billing-open': ['billing-webhook-active'],
  'billing-closed': ['billing-revoked'],
  external: ['watch-child-notification', 'github-oauth-pr'],
  'registry-cli': ['cli-registry-loop'],
}

export function journeyAnnotation(id) {
  return `[journey:${id}]`
}
