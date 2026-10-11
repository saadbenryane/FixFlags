/** Historical names are presentation aliases, never evidence for a current check. */
const HISTORICAL_CHECK_ALIASES: Readonly<Record<string, string>> = {
  'measurement-pixel-missing': 'measurement-ga-gtm-posthog-missing',
}

export function canonicalHistoricalCheckId(value: string | null | undefined): string {
  const identity = (value ?? '').toLowerCase().split('::page:')[0]
  return HISTORICAL_CHECK_ALIASES[identity] ?? identity
}
