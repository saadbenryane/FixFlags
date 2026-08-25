export const REQUIRED_RELEASE_JOURNEYS = [
  'anonymous-claim',
  'free-chat-timeline',
  'passkey-2fa-recovery',
  'billing-webhook-active',
  'billing-revoked',
  'shared-canvas',
  'shared-product-boundary',
  'protected-sharing',
  'attempt-update-receipt',
  'watch-child-notification',
]

// Retained for an explicit, non-customer power-tools verification run. These
// annotations remain valid, but they cannot satisfy or block the web release.
export const PARKED_POWER_TOOL_JOURNEYS = [
  'github-oauth-pr',
  'mcp-full-loop',
  'cli-registry-loop',
]

export const KNOWN_RELEASE_JOURNEYS = [
  ...REQUIRED_RELEASE_JOURNEYS,
  ...PARKED_POWER_TOOL_JOURNEYS,
]

export const JOURNEYS_BY_STAGE = {
  'credentialed-core': [
    'anonymous-claim',
    'free-chat-timeline',
    'passkey-2fa-recovery',
    'shared-canvas',
    'shared-product-boundary',
    'protected-sharing',
    'attempt-update-receipt',
  ],
  'billing-open': ['billing-webhook-active'],
  'billing-closed': ['billing-revoked'],
  external: ['watch-child-notification'],
}

export function journeyAnnotation(id) {
  return `[journey:${id}]`
}
