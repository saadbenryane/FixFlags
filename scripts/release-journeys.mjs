// The launch loop is Site -> Outcome -> Clear/Flag -> evidence -> Fix ->
// independent Verify -> Watch. The journeys below are the release proof of that
// loop, and every id here must correspond to a real `[journey:...]` test.
//
// `inspectPlaywrightJourneys` rejects any journey in the report that is not
// listed here, and `requireStageJourneys` fails a stage when a journey it owns
// is missing, skipped, or not passing. A stale entry in either direction breaks
// `npm run verify:release`, so these lists are part of the release contract
// rather than documentation.
//
// Journeys whose success condition is the retired report-era product (report
// chat, Product creation, the update-review loop, the parked repository scan)
// were removed. The canonical Outcome loop replaced them.
export const REQUIRED_RELEASE_JOURNEYS = [
  // The customer loop, end to end, on a claimed Site.
  'outcome-loop',
  'watch-truth',
  'tenant-isolation',
  'site-surfaces',
  'mcp-full-loop',
  // Access and identity.
  'anonymous-claim',
  'passkey-2fa-recovery',
  // Billing, in both switch states.
  'billing-webhook-active',
  'billing-revoked',
  // Continued verification without an agent.
  'watch-child-notification',
]

// Retained for an explicit, non-customer power-tools verification run. These
// annotations remain valid, but they cannot satisfy or block the web release.
export const PARKED_POWER_TOOL_JOURNEYS = [
  'cli-registry-loop',
]

export const KNOWN_RELEASE_JOURNEYS = [
  ...REQUIRED_RELEASE_JOURNEYS,
  ...PARKED_POWER_TOOL_JOURNEYS,
]

export const JOURNEYS_BY_STAGE = {
  'credentialed-core': [
    'outcome-loop',
    'watch-truth',
    'tenant-isolation',
    'site-surfaces',
    'mcp-full-loop',
    'anonymous-claim',
    'passkey-2fa-recovery',
  ],
  'billing-open': ['billing-webhook-active'],
  'billing-closed': ['billing-revoked'],
  external: ['watch-child-notification'],
}

export function requiredReleaseJourneys(profile = 'free-launch') {
  if (!['free-launch', 'paid-opening'].includes(profile)) throw new Error(`Unknown release profile: ${profile}`)
  return REQUIRED_RELEASE_JOURNEYS.filter(id => profile === 'paid-opening' || id !== 'billing-webhook-active')
}

export function journeyAnnotation(id) {
  return `[journey:${id}]`
}
