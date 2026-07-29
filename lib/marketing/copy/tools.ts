export const MCP_DOCS = {
  builderRequired: 'Requires Pro plan',
} as const

export const PRODUCT_WATCH_COPY = {
  description: 'FixFlags re-checks this product on a schedule and emails you only when something regresses.',
  weekly: 'Weekly',
  daily: 'Daily',
  off: 'Off',
  proLink: 'Pro adds weekly watch',
  unavailable: 'Product Watch is unavailable until scheduling and email delivery are configured.',
  updateFailed: 'Could not update Product Watch.',
  loadFailed: 'Could not load Product Watch status.',
  successWeekly: 'Weekly Product Watch enabled.',
  successDaily: 'Daily Product Watch enabled.',
  successOff: 'Product Watch turned off.',
  nextRun: 'Next check',
  lastRun: 'Last successful check',
  lastAttempt: 'Last attempt',
  never: 'Not yet',
} as const
